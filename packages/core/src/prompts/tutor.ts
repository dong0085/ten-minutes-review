import { z } from "zod";
import { normalizeAnswerText } from "../grading";
import type { QuestionAnswer, QuestionType } from "../types";

export const TUTOR_PROMPT_VERSION = "tutor-v1";

export const TUTOR_HINT_PROMPT_V1 = `You are a patient language tutor helping a learner correct a question they got wrong before.

You receive the question (stem, type, options), the knowledge point it tests,
the one-line explanation printed under it, the right answer, the hint level
(1, 2, or 3), and the hints already given. The learner has not answered yet.

Your job is one hint that moves them one step closer without doing the work.

Rules:

1. Never give the answer. Never write the right option, the right word, or the
   right form, in any language, spelled out or letter by letter. Never say
   which option letter is right, and never say "true" or "false" for a
   true-or-false statement. Never eliminate all the wrong options at once.

2. Scale by level:
   - Level 1: point at what to notice. Name the kind of thing being tested (a
     gender, a tense, a false friend, word order) or the clue in the sentence.
   - Level 2: recall the rule or pattern that decides it, in plain words, with
     an example that uses a different word than the question.
   - Level 3: walk the reasoning up to the last step and ask the learner to
     take it; you may rule out one wrong option and say why.

3. Build on the earlier hints; never repeat one.

4. Two or three short sentences. End with a question that invites the learner
   to try.

5. Write in the language named by "writeIn". Quote target-language words from
   the question as they are.

6. Output JSON only: {"hint": "..."}`;

export const TUTOR_ANALYSIS_PROMPT_V1 = `You are a patient language tutor. A learner has just answered a question wrong again while correcting their mistakes.

You receive the question (stem, type, options), the knowledge point it tests,
the one-line explanation printed under it, the right answer, the learner's
answer now, and how many times they have missed it. The right answer and that
explanation are already on their screen. Go deeper than they do.

Rules:

1. Say what their answer shows they believe, and where that belief breaks,
   quoting their answer next to the right one.

2. Explain the rule that decides it, plainly, the way a teacher would in the
   margin. Gloss any grammar term you use.

3. Give one or two fresh example sentences that use the rule correctly, in the
   target language, each with a short translation.

4. Give one short memory trick or a check the learner can run next time.

5. Stay warm and direct. No praise padding, no apologies.

6. Write in the language named by "writeIn". Quote target-language words as
   they are.

7. Output JSON only:
   {"diagnosis": "...", "rule": "...", "examples": [{"target": "...", "translation": "..."}], "tip": "..."}`;

const hintSchema = z.object({ hint: z.string().min(1) });

const analysisSchema = z.object({
  diagnosis: z.string().min(1),
  rule: z.string().min(1),
  examples: z
    .array(z.object({ target: z.string().min(1), translation: z.string().optional().default("") }))
    .optional()
    .default([]),
  tip: z.string().optional().default(""),
});

export type TutorHint = { hint: string };

export type TutorAnalysis = {
  diagnosis: string;
  rule: string;
  examples: { target: string; translation: string }[];
  tip: string;
};

export type TutorContent = TutorHint | TutorAnalysis;

/** The words a hint must never contain, normalized the way grading compares answers. */
export function answerGiveaways(
  type: QuestionType,
  options: readonly string[] | null,
  answer: QuestionAnswer,
): string[] {
  const texts: string[] = [];
  if ((type === "mcq" || type === "image") && "index" in answer) {
    const option = options?.[answer.index];
    if (option) {
      texts.push(option);
    }
  }
  if ("blanks" in answer) {
    texts.push(...answer.blanks, ...(answer.accepted ?? []).flat());
  }
  // Very short answers ("a", "le") show up in any sentence; they are left to the prompt.
  return texts.map(normalizeAnswerText).filter((text) => text.length >= 3);
}

export function leaksAnswer(text: string, giveaways: readonly string[]): boolean {
  const normalized = normalizeAnswerText(text);
  return giveaways.some((giveaway) => normalized.includes(giveaway));
}

/** Parses a hint, rejecting one that spells out the answer so the job retries. */
export function parseTutorHint(json: unknown, giveaways: readonly string[]): TutorHint {
  const { hint } = hintSchema.parse(json);
  if (leaksAnswer(hint, giveaways)) {
    throw new Error("tutor hint gave away the answer");
  }
  return { hint: hint.trim() };
}

export function parseTutorAnalysis(json: unknown): TutorAnalysis {
  const parsed = analysisSchema.parse(json);
  return {
    diagnosis: parsed.diagnosis.trim(),
    rule: parsed.rule.trim(),
    examples: parsed.examples.slice(0, 2).map((example) => ({
      target: example.target.trim(),
      translation: example.translation.trim(),
    })),
    tip: parsed.tip.trim(),
  };
}
