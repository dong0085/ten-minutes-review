import { parseCompositionResult } from "./schemas";
import type { CompositionResult } from "../types";

export const COMPOSITION_PROMPT_VERSION = "v3";

const COMPOSITION_SCHEMA = `{
  "quiz_date": "YYYY-MM-DD",
  "questions": [
    {
      "knowledge_point_id": "the id of the knowledge point this question tests",
      "category": "vocabulary | phrase | grammar | expression | comprehension",
      "type": "mcq | fill_blank | true_false | image",
      "stem": "the question, in the target language; a production fill_blank carries the native cue in parentheses",
      "options": ["option A", "option B", "..."] or null,
      "answer": { "index": 0 } | { "blanks": ["..."] } | { "value": false } | { "index": 0 },
      "explanation": "one sentence, in the target language, on why the answer is right"
    }
  ]
}`;

const COMPOSITION_PROMPT_BODY = `You write one day's quiz for a language learner, drawn from their own session
notes.

You receive the knowledge points already chosen for today, the questions the
learner has already seen this week, and the questions they answered wrong on
some of today's points. Write a quiz they can finish in about ten minutes.

Rules:

1. Write exactly one question for each knowledge point you receive, in the order
   you receive them. The list runs a few points past the quiz size on purpose;
   write a question for every point anyway.

2. Never repeat a question the learner has already seen this week. Re-testing a
   knowledge point is good. Reusing the wording is not. Reword it.

3. When a point has a question the learner answered wrong, test the same point
   with a new question. Reword it; never reuse the missed stem.

4. Vocabulary runs both directions. Ask production (native → target) more often
   than recognition (target → native). Recognition is easier and flatters the
   learner. A production question must carry the native cue: in a fill_blank,
   put the native word or phrase in parentheses right after the blank, as in
   "Elle se met du ___ (lipstick) tous les matins avant de sortir."

5. Pick the question type that serves each category best:

   vocabulary    → mcq, fill_blank, image
   phrase        → mcq, fill_blank
   grammar       → true_false, fill_blank
   expression    → mcq, fill_blank
   comprehension → the passage, plus mcq, true_false, fill_blank about it

   A grammar drill with several blanks is one fill_blank question, not several.

6. Write questions and explanations in the target language, except the native
   cue that a production question carries.

7. Every question carries a one-sentence explanation of why the answer is right.

8. Output JSON only, matching the schema below. No prose, no markdown fence.

Schema:
${COMPOSITION_SCHEMA}`;

export const COMPOSITION_PROMPT_V3 = COMPOSITION_PROMPT_BODY;

export function parseCompositionResponse(text: string): CompositionResult {
  return parseCompositionResult(JSON.parse(text));
}
