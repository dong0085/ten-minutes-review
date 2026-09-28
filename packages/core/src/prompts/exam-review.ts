import { z } from "zod";

export const EXAM_REVIEW_PROMPT_VERSION = "exam-review-v1";

const EXAM_REVIEW_SCHEMA = `{
  "overview": "two or three sentences on how the exam went and the main thing to work on",
  "patterns": [
    {
      "title": "a short name for the pattern, at most eight words",
      "detail": "two to four sentences: what the learner keeps doing, why it is wrong, and the rule or habit that fixes it, quoting their own answers",
      "questions": [3, 17]
    }
  ],
  "next_steps": ["one concrete thing to practise, one sentence"]
}`;

export const EXAM_REVIEW_PROMPT_V1 = `You review a language learner's exam and explain the patterns behind their mistakes.

You receive the exam's score by part, and every question the learner answered
wrong: its number on the paper, its type, the knowledge point it tested, the
stem, the options, the learner's answer, the right answer, and the one-line
explanation already printed under it. The learner has read those explanations.
Your job is the view from above: what the mistakes have in common.

Rules:

1. Find one to four patterns. A pattern is a habit that shows up in more than one
   answer: confusing two tenses, dropping agreement, picking the false friend,
   leaving blanks empty, misreading negative statements. A single mistake that
   fits no pattern belongs in a pattern only when it is the most important thing
   to fix. Order patterns from the one that cost the most points to the least.

2. Ground every pattern in the learner's own answers. Quote what they wrote next
   to what was expected. List the question numbers it covers in "questions",
   using only numbers from the missed questions you received.

3. Explain the rule behind each pattern plainly, the way a patient teacher
   would in the margin. No jargon without a short gloss.

4. Give one to three next steps: concrete things to practise, each one sentence.

5. Write in the language named by "writeIn". Quote target-language words and
   sentences as they are, without translating them away.

6. Stay warm and direct. No grades, no praise padding, no apologies.

7. Output JSON only, matching the schema below. No prose, no markdown fence.

Schema:
${EXAM_REVIEW_SCHEMA}`;

export const examReviewSchema = z.object({
  overview: z.string().min(1),
  patterns: z
    .array(
      z.object({
        title: z.string().min(1),
        detail: z.string().min(1),
        questions: z.array(z.number().int()).optional().default([]),
      }),
    )
    .min(1),
  next_steps: z.array(z.string().min(1)).optional().default([]),
});

export type ExamReview = {
  overview: string;
  patterns: { title: string; detail: string; questions: number[] }[];
  nextSteps: string[];
};

/**
 * Parses the model's review and keeps it inside the paper: question numbers
 * outside the missed set are dropped, and the lists are capped at what the
 * prompt asks for.
 */
export function parseExamReview(json: unknown, missedNumbers: readonly number[]): ExamReview {
  const parsed = examReviewSchema.parse(json);
  const missed = new Set(missedNumbers);
  return {
    overview: parsed.overview.trim(),
    patterns: parsed.patterns.slice(0, 4).map((pattern) => ({
      title: pattern.title.trim(),
      detail: pattern.detail.trim(),
      questions: Array.from(new Set(pattern.questions.filter((number) => missed.has(number)))).sort(
        (a, b) => a - b,
      ),
    })),
    nextSteps: parsed.next_steps.slice(0, 3).map((step) => step.trim()),
  };
}
