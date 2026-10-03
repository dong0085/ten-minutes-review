import { parseExtractionResult, parseRereadResult } from "./schemas";
import type { NoteEditPlan, StoredNotePoint } from "../note-lines";
import type { ExtractionResult, RereadResult } from "../types";

export const EXTRACTION_PROMPT_VERSION = "v3";
export const REREAD_PROMPT_VERSION = "reread-v1";

const EXTRACTION_SCHEMA = `{
  "subject": "a short subject line naming what the notes cover, in the native language",
  "target_language": "ISO 639-1 code of the language being learned",
  "native_language": "ISO 639-1 code of the language the glosses are in",
  "knowledge_points": [
    {
      "category": "vocabulary | phrase | grammar | expression | comprehension",
      "target_text": "the term, phrase, rule label, or full sentence",
      "native_text": "the gloss or translation, or null if none",
      "inferred": "true when the gloss was inferred, not read from the notes",
      "note": "a correction or caveat, or null when clean",
      "grammar": "for grammar only: { \\"rule\\": string, \\"examples\\": [ { \\"target\\": string, \\"related\\": string | null } ] }",
      "passage_ref": "for comprehension only: index into passages",
      "source_excerpt": "the raw note line this came from"
    }
  ],
  "passages": [
    {
      "target_text": "the passage in the target language",
      "native_text": "its translation, or null",
      "source_excerpt": "the raw note line this came from"
    }
  ],
  "discarded": [ { "line": "the raw line", "reason": "a short reason" } ]
}`;

const EXTRACTION_PROMPT_BODY = `You turn a language learner's raw session notes into structured study material.

The notes come from a live tutoring session and were written down quickly.
Expect no consistent separator between entries, entries with no translation,
misspellings, fragments, and lines that are simply garbled.

Extract what is genuinely studyable. Discard the rest.

Rules:

1. Classify every extracted item into exactly one of: vocabulary, phrase,
   grammar, expression, comprehension.

2. Detect the language being learned (target) and the language the glosses are
   written in (native). Report both as ISO 639-1 codes.

3. Never invent a gloss. When a term carries no translation in the notes, you
   may infer one from context and set "inferred": true. When you cannot infer
   it confidently, discard the line.

4. Discard any line that is garbled, unintelligible, or carries nothing
   studyable. List every discard with a short reason. Discarding is correct
   behaviour, not a failure. A missing question costs the learner nothing; a
   wrong one costs them trust.

5. Grammar arrives as teaching, not as a list. When the notes state a rule —
   even in shorthand like "noun et adjective différence" — capture the rule
   together with the examples that belong to it.

6. Preserve the target-language spelling exactly as written. Correct an obvious
   typo only when you are confident, and record the correction in "note".

7. Emit one knowledge point per item. Two distinct terms are two knowledge
   points.

8. Write explanations in the target language.

9. Write "subject": a short subject line, three to eight words, naming the topic
   the notes cover, in the native language. Name the theme, not the first line.

10. Output JSON only, matching the schema below. No prose, no markdown fence.

Schema:
${EXTRACTION_SCHEMA}`;

export const EXTRACTION_PROMPT_V2 = EXTRACTION_PROMPT_BODY;

// Rules 1-8 of V2, shared by the line-aware prompts so the readings stay alike.
const READING_RULES = EXTRACTION_PROMPT_BODY.slice(
  EXTRACTION_PROMPT_BODY.indexOf("1. Classify"),
  EXTRACTION_PROMPT_BODY.indexOf("9. Write"),
).trimEnd();

const LINES_SCHEMA_HINT = `"lines": "the numbers of the note lines this came from, e.g. [3] or [3, 4]"`;

const EXTRACTION_SCHEMA_V3 = EXTRACTION_SCHEMA.replace(
  /"source_excerpt": "the raw note line this came from"/g,
  `"source_excerpt": "the raw note line this came from",\n      ${LINES_SCHEMA_HINT}`,
);

export const EXTRACTION_PROMPT_V3 = `You turn a language learner's raw session notes into structured study material.

The notes come from a live tutoring session and were written down quickly.
Expect no consistent separator between entries, entries with no translation,
misspellings, fragments, and lines that are simply garbled.

Typed notes arrive as numbered lines, one per line, written "12| text". Blank
lines keep their number. Photographed notes arrive as an image with no numbers.

Extract what is genuinely studyable. Discard the rest.

Rules:

${READING_RULES}

9. Write "subject": a short subject line, three to eight words, naming the topic
   the notes cover, in the native language. Name the theme, not the first line.

10. Give every knowledge point and passage "lines": the numbers of the lines it
    came from. Use only numbers that appear in the notes. When an item draws on
    several lines — a rule with its examples, a passage — list all of them. For
    notes that arrive as an image, set "lines" to [].

11. Output JSON only, matching the schema below. No prose, no markdown fence.

Schema:
${EXTRACTION_SCHEMA_V3}`;

const REREAD_SCHEMA = `{
  "subject": "only when \"full\" is true: a short subject line in the native language; else null",
  "updates": [
    {
      "ref": "the ref of the existing point",
      "category": "the point's category, unchanged",
      "target_text": "...", "native_text": "...", "inferred": false, "note": null,
      "grammar": "for grammar only, as in knowledge_points",
      ${LINES_SCHEMA_HINT}
    }
  ],
  "removals": ["the ref of each existing point to remove"],
  "knowledge_points": [
    {
      "category": "vocabulary | phrase | grammar | expression | comprehension",
      "target_text": "the term, phrase, rule label, or full sentence",
      "native_text": "the gloss or translation, or null if none",
      "inferred": "true when the gloss was inferred, not read from the notes",
      "note": "a correction or caveat, or null when clean",
      "grammar": "for grammar only: { \"rule\": string, \"examples\": [ { \"target\": string, \"related\": string | null } ] }",
      "passage_ref": "for comprehension only: index into passages",
      "source_excerpt": "the raw note line this came from",
      ${LINES_SCHEMA_HINT}
    }
  ],
  "passages": [
    {
      "target_text": "the passage in the target language",
      "native_text": "its translation, or null",
      "source_excerpt": "the raw note lines this came from",
      ${LINES_SCHEMA_HINT}
    }
  ],
  "discarded": [ { "line": "the raw line", "reason": "a short reason" } ]
}`;

export const REREAD_PROMPT_V1 = `You update a language learner's study material after they edited their session notes.

The notes come from a live tutoring session and were written down quickly.
Expect no consistent separator between entries, entries with no translation,
misspellings, fragments, and lines that are simply garbled.

You receive JSON:
- "lines": part of the edited notes as { "n", "text", "editable" }. Editable
  lines were changed or belong to points under review. The other lines are
  context: read them, but take nothing new from them.
- "points": existing points that came from the editable lines, each with a
  "ref" and the lines it came from.
- "other_points": points from the same notes that stay as they are.
- "full": true when the learner asked for the whole note to be read again.

Decide, for each entry in "points":
- keep it: leave it out of the reply;
- update it: it is the same item, now corrected or completed. List it in
  "updates" with every field, its "ref", and its category unchanged;
- remove it: the notes no longer contain it, or the line now says something
  different. List its ref in "removals".
Then extract every studyable item in the editable lines that no point covers
yet. Never repeat an entry from "points" or "other_points".

Rules for every item you write:

${READING_RULES}

9. Give every item "lines": the "n" of each line it came from. Use only numbers
   from "lines". A new item must come from at least one editable line.

10. Output JSON only, matching the schema below. No prose, no markdown fence.

Schema:
${REREAD_SCHEMA}`;

/** Typed notes as the model reads them: one numbered line per note line. */
export function renderNumberedLines(lines: readonly { text: string }[]): string {
  return lines.map((line, index) => `${index + 1}| ${line.text}`).join("\n");
}

function pointPayload(point: StoredNotePoint, numbers: ReadonlyMap<string, number>) {
  return {
    category: point.category,
    target_text: point.targetText,
    native_text: point.nativeText,
    note: point.note,
    ...(point.grammar ? { grammar: point.grammar } : {}),
    lines: point.lineIds
      .map((id) => numbers.get(id))
      .filter((value): value is number => value !== undefined),
  };
}

/** The JSON the re-read prompt receives for one edit. */
export function buildRereadPayload(
  plan: NoteEditPlan,
  languages: { target: string | null; native: string | null },
) {
  const numbers = new Map(plan.lines.map((line, index) => [line.id, index + 1] as const));
  return {
    target_language: languages.target,
    native_language: languages.native,
    full: plan.full,
    lines: plan.window.map((line) => ({ n: line.number, text: line.text, editable: line.editable })),
    points: plan.points.map(({ ref, point }) => ({ ref, ...pointPayload(point, numbers) })),
    other_points: plan.contextPoints.map((point) => pointPayload(point, numbers)),
  };
}

export function parseExtractionResponse(text: string): ExtractionResult {
  return parseExtractionResult(JSON.parse(text));
}

export function parseRereadResponse(text: string): RereadResult {
  return parseRereadResult(JSON.parse(text));
}
