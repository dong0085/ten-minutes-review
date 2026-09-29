import { z } from "zod";
import type { CompositionQuestion } from "@tmr/core";
import type { CompositionPayload } from "../llm";

export const JUDGE_CHECKS = [
  "answer_correct",
  "one_right_answer",
  "no_giveaway",
  "plausible_distractors",
  "clear_cue",
  "natural_language",
] as const;

export type JudgeCheck = (typeof JUDGE_CHECKS)[number];

export const JUDGE_PROMPT = `You review quiz questions written for a language learner. Each question
tests one knowledge point taken from the learner's own class notes. A good
question shows whether the learner can recall or use that point from memory.

The learner sees only the stem and the options. The knowledge point, answer,
and explanation are shown to you so you can check the question; words shared
with them are not a giveaway. A native-language cue in parentheses, such as
"___ (the ceiling)", is how production questions work: the learner still has to
produce the target-language word, so the cue is not a giveaway, even when it
translates the answer word for word. The same holds for a native-language
meaning in the stem of an mcq whose options are in the target language. Context
that helps someone who knows the point is good; a giveaway lets someone who
does not know the point answer anyway, for example because the right option
repeats words from the stem.

For each question, answer these checks with true or false:

- answer_correct: the marked answer is right, and so is every entry in
  acceptedAnswers when put back into the sentence (right gender, number, and
  spelling, no doubled article).
- one_right_answer: exactly one option is right. For a fill_blank, graded by
  exact match ignoring accents and capitals: every answer a learner who knows
  the point would reasonably type is in rightAnswer or acceptedAnswers (spelling
  variants, synonyms that fit, with or without an article). False when a
  correct answer would be marked wrong.
- no_giveaway: the learner cannot find the answer by matching words between the
  stem and the options, by grammar clues (article, gender, plural) that only fit
  one option, or by one option looking different from the rest.
- plausible_distractors: each wrong option could fool someone who half-knows the
  point, and comes from the same topic or word class. Use null when the
  question has no options.
- clear_cue: the learner can tell what is being asked. A question asking for a
  target-language word or phrase carries the native cue or an unambiguous
  definition. A fill_blank has one sensible answer given its cue.
- natural_language: the stem reads like something a teacher would write, with no
  grammar mistakes.

Then give a score from 1 to 5: 5 is a question a good teacher would use as is,
3 works but is weak, 1 is broken or misleading. Name the main problem in one
short English sentence, or null when there is none.

Output JSON only:
{
  "reviews": [
    {
      "index": 0,
      "answer_correct": true,
      "one_right_answer": true,
      "no_giveaway": true,
      "plausible_distractors": true,
      "clear_cue": true,
      "natural_language": true,
      "score": 4,
      "problem": null
    }
  ]
}`;

const reviewSchema = z.object({
  index: z.number().int(),
  answer_correct: z.boolean(),
  one_right_answer: z.boolean(),
  no_giveaway: z.boolean(),
  plausible_distractors: z.boolean().nullable(),
  clear_cue: z.boolean(),
  natural_language: z.boolean(),
  score: z.number().min(1).max(5),
  problem: z.string().nullable(),
});

export type JudgeReview = z.infer<typeof reviewSchema>;

function rightAnswer(question: CompositionQuestion): string {
  const answer = question.answer;
  if ("index" in answer) {
    return question.options?.[answer.index] ?? `option ${answer.index}`;
  }
  if ("blanks" in answer) {
    return answer.blanks.join(" | ");
  }
  return String(answer.value);
}

export function judgePayload(payload: CompositionPayload, questions: CompositionQuestion[]) {
  const points = new Map(payload.knowledgePoints.map((point) => [point.id, point]));
  return {
    targetLanguage: payload.targetLanguage,
    nativeLanguage: payload.nativeLanguage,
    questions: questions.map((question, index) => {
      const point = points.get(question.knowledge_point_id);
      return {
        index,
        knowledgePoint: point
          ? { category: point.category, target: point.target, native: point.native, detail: point.detail }
          : null,
        type: question.type,
        stem: question.stem,
        options: question.options,
        rightAnswer: rightAnswer(question),
        acceptedAnswers: "accepted" in question.answer ? question.answer.accepted ?? [] : [],
        explanation: question.explanation,
      };
    }),
  };
}

export function parseJudgeResponse(json: unknown, count: number): (JudgeReview | null)[] {
  const parsed = z.object({ reviews: z.array(z.unknown()) }).parse(json);
  const byIndex = new Map<number, JudgeReview>();
  for (const entry of parsed.reviews) {
    const review = reviewSchema.safeParse(entry);
    if (review.success) {
      byIndex.set(review.data.index, review.data);
    }
  }
  return Array.from({ length: count }, (_, index) => byIndex.get(index) ?? null);
}

/** The checks a review failed. A null distractor check means it does not apply. */
export function failedChecks(review: JudgeReview): JudgeCheck[] {
  return JUDGE_CHECKS.filter((check) => review[check] === false);
}
