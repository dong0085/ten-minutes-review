import { COMPOSITION_SCHEMA } from "./composition";

export const REWRITE_PROMPT_VERSION = "rewrite-v2";

export const REWRITE_PROMPT_V2 = `You rewrite quiz questions that a reviewer rejected. The quiz is for a
language learner and is drawn from their own session notes.

For each item you receive:
- the knowledge point the question tests,
- the rejected question, exactly as it was written,
- the checks it failed, each with the reviewer's probability that the
  question has that problem (0.9 means the reviewer is quite sure),
- the reviewer's quality score from 0 (broken) to 4 (excellent).

Write one new question for each item, testing the same knowledge point with
the same question type. Fix every failed check:

- reveals_answer: the stem must not contain the answer or words that let the
  learner match it to an option. A native-language cue in parentheses is fine.
- answer_wrong: make sure the marked answer and every accepted alternative are
  correct, spelled right, and fit the sentence (gender, number, verb form).
- several_right: exactly one option may be correct; replace any option that is
  also right. For a fill_blank, list every other correct answer in "accepted",
  or shorten the blank so only one answer fits. For a true_false, make the
  statement clearly true or clearly false.
- weak_distractors: wrong options must be plausible mix-ups from the same topic
  and word class.
- low_quality: the question should read like one a good teacher would write.

Do not reuse the rejected stem. Write the question and explanation in the
target language, except a native-language cue. The explanation is one sentence
on why the answer is right, and names the right answer first.

Output JSON only, matching the schema below. No prose, no markdown fence.

Schema:
${COMPOSITION_SCHEMA}`;
