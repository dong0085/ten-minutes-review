import { z } from "zod";
import type {
  CompositionQuestion,
  CompositionResult,
  ExtractionResult,
  QuestionAnswer,
  QuestionType,
} from "../types";
import { CATEGORIES, QUESTION_TYPES } from "../types";
import { normalizeAnswerText } from "../grading";

const grammarExampleSchema = z.object({
  target: z.string(),
  related: z.string().nullable().optional().default(null),
});

const grammarDetailSchema = z.object({
  rule: z.string(),
  examples: z.array(grammarExampleSchema).optional().default([]),
});

export const extractionResultSchema = z.object({
  subject: z.string().nullable().optional().default(null),
  target_language: z.string(),
  native_language: z.string(),
  knowledge_points: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        target_text: z.string().nullable().optional().default(null),
        native_text: z.string().nullable().optional().default(null),
        inferred: z.boolean().optional().default(false),
        note: z.string().nullable().optional().default(null),
        grammar: grammarDetailSchema.nullable().optional().default(null),
        passage_ref: z.number().int().nullable().optional().default(null),
        source_excerpt: z.string().nullable().optional().default(null),
      }),
    )
    .optional()
    .default([]),
  passages: z
    .array(
      z.object({
        target_text: z.string(),
        native_text: z.string().nullable().optional().default(null),
        source_excerpt: z.string().nullable().optional().default(null),
      }),
    )
    .optional()
    .default([]),
  discarded: z
    .array(
      z.object({
        line: z.string(),
        reason: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export const compositionResultSchema = z.object({
  quiz_date: z.string(),
  questions: z
    .array(
      z.object({
        knowledge_point_id: z.string(),
        category: z.enum(CATEGORIES),
        type: z.enum(QUESTION_TYPES),
        stem: z.string(),
        options: z.array(z.string()).nullable().optional().default(null),
        answer: z.unknown(),
        explanation: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export function parseExtractionResult(json: unknown): ExtractionResult {
  const parsed = extractionResultSchema.parse(json);
  return {
    subject: parsed.subject,
    target_language: parsed.target_language,
    native_language: parsed.native_language,
    knowledge_points: parsed.knowledge_points.map((point) => ({
      category: point.category,
      target_text: point.target_text,
      native_text: point.native_text,
      inferred: point.inferred,
      note: point.note,
      grammar: point.grammar,
      passage_ref: point.passage_ref,
      source_excerpt: point.source_excerpt,
    })),
    passages: parsed.passages.map((passage) => ({
      target_text: passage.target_text,
      native_text: passage.native_text,
      source_excerpt: passage.source_excerpt,
    })),
    discarded: parsed.discarded,
  };
}

function isAnswerFor(type: QuestionType, answer: unknown): answer is QuestionAnswer {
  if (typeof answer !== "object" || answer === null) {
    return false;
  }
  const record = answer as Record<string, unknown>;
  if (type === "mcq" || type === "image") {
    return typeof record.index === "number" && Number.isInteger(record.index);
  }
  if (type === "true_false") {
    return typeof record.value === "boolean";
  }
  return (
    Array.isArray(record.blanks) &&
    record.blanks.length > 0 &&
    record.blanks.every((blank) => typeof blank === "string")
  );
}

// Keeps a fill_blank's accepted alternatives only when they line up with its
// blanks, dropping empty entries and repeats of the main answer.
function cleanAnswer(type: QuestionType, answer: QuestionAnswer): QuestionAnswer {
  if (type !== "fill_blank" || !("blanks" in answer)) {
    return answer;
  }
  const raw = (answer as { accepted?: unknown }).accepted;
  const accepted = answer.blanks.map((blank, index) => {
    const entry = Array.isArray(raw) ? raw[index] : null;
    if (!Array.isArray(entry)) {
      return [];
    }
    const seen = new Set([normalizeAnswerText(blank)]);
    return entry.filter((option): option is string => {
      if (typeof option !== "string" || !option.trim() || seen.has(normalizeAnswerText(option))) {
        return false;
      }
      seen.add(normalizeAnswerText(option));
      return true;
    });
  });
  return accepted.some((entry) => entry.length > 0)
    ? { blanks: answer.blanks, accepted }
    : { blanks: answer.blanks };
}

export function parseCompositionResult(json: unknown): CompositionResult {
  const parsed = compositionResultSchema.parse(json);
  const questions: CompositionQuestion[] = [];
  for (const question of parsed.questions) {
    if (!isAnswerFor(question.type, question.answer)) {
      continue;
    }
    questions.push({
      knowledge_point_id: question.knowledge_point_id,
      category: question.category,
      type: question.type,
      stem: question.stem,
      options: question.options,
      answer: cleanAnswer(question.type, question.answer),
      explanation: question.explanation,
    });
  }
  return { quiz_date: parsed.quiz_date, questions };
}

export type DroppedQuestion = {
  question: CompositionQuestion;
  reason: string;
};

function comparable(text: string): string {
  return text.normalize("NFC").toLocaleLowerCase().trim();
}

// The option the explanation quotes first, or null when it quotes none. An
// explanation leads with the right option ("« X » means…; « Y » means…"), so a
// first-quoted option that differs from the answer index means the index is wrong.
export function firstOptionNamed(options: readonly string[], explanation: string): number | null {
  const text = comparable(explanation);
  let first: { index: number; at: number; length: number } | null = null;
  for (const [index, option] of options.entries()) {
    const needle = comparable(option);
    const at = needle.length < 2 ? -1 : text.indexOf(needle);
    if (at < 0) {
      continue;
    }
    if (!first || at < first.at || (at === first.at && needle.length > first.length)) {
      first = { index, at, length: needle.length };
    }
  }
  return first?.index ?? null;
}

// Leading articles an option may carry ("Un étendoir") that a stem drops ("l'étendoir").
const LEADING_ARTICLE =
  /^(?:(?:le|la|les|un|une|des|du|de|the|a|an|el|los|las|unos|unas|der|die|das|ein|eine) |(?:l|d)['’])/;

function answerCore(text: string): string {
  return normalizeAnswerText(text).replace(LEADING_ARTICLE, "");
}

function containsWords(haystack: string, needle: string): boolean {
  if (needle.length < 3) {
    return false;
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(haystack);
}

// True when the stem spells out the answer, so the learner can match words
// instead of recalling them. An mcq stem that names every option it compares
// ("le ou la ?") is fine; one that names only the right option is not. Grammar
// stems name the forms they drill ("por o para", "en colère → ?"), so they pass.
export function stemGivesAwayAnswer(question: CompositionQuestion): boolean {
  if (question.category === "grammar") {
    return false;
  }
  const stem = normalizeAnswerText(question.stem);
  const answer = question.answer;
  if ((question.type === "mcq" || question.type === "image") && "index" in answer) {
    const options = question.options ?? [];
    const right = options[answer.index];
    if (right === undefined || !containsWords(stem, answerCore(right))) {
      return false;
    }
    return !options.some(
      (option, index) => index !== answer.index && containsWords(stem, answerCore(option)),
    );
  }
  if ("blanks" in answer) {
    return [...answer.blanks, ...(answer.accepted ?? []).flat()].some((blank) =>
      containsWords(stem, answerCore(blank)),
    );
  }
  return false;
}

/** A blank longer than this is a sentence to type from memory, which exact-match grading judges badly. */
export const MAX_BLANK_WORDS = 4;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function sanitizeCompositionQuestions(
  questions: CompositionQuestion[],
  validKnowledgePointIds: ReadonlySet<string>,
): { kept: CompositionQuestion[]; dropped: DroppedQuestion[] } {
  const kept: CompositionQuestion[] = [];
  const dropped: DroppedQuestion[] = [];

  for (const question of questions) {
    if (!validKnowledgePointIds.has(question.knowledge_point_id)) {
      dropped.push({ question, reason: "unknown knowledge point" });
      continue;
    }
    if (question.type === "mcq" || question.type === "image") {
      if (!question.options || question.options.length < 2) {
        dropped.push({ question, reason: "missing options" });
        continue;
      }
      const index = (question.answer as { index?: unknown }).index;
      if (typeof index !== "number" || index < 0 || index >= question.options.length) {
        dropped.push({ question, reason: "answer index outside options" });
        continue;
      }
      const named = firstOptionNamed(question.options, question.explanation);
      if (named !== null && named !== index) {
        dropped.push({ question, reason: "explanation names a different option" });
        continue;
      }
    }
    if ("blanks" in question.answer && question.answer.blanks.some((blank) => wordCount(blank) > MAX_BLANK_WORDS)) {
      dropped.push({ question, reason: "blank answer too long" });
      continue;
    }
    if (stemGivesAwayAnswer(question)) {
      dropped.push({ question, reason: "stem gives away the answer" });
      continue;
    }
    kept.push(question);
  }

  return { kept, dropped };
}
