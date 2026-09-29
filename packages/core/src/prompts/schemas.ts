import { z } from "zod";
import type {
  CompositionQuestion,
  CompositionResult,
  ExtractionResult,
  QuestionAnswer,
  QuestionType,
} from "../types";
import { CATEGORIES, QUESTION_TYPES } from "../types";

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
      answer: question.answer,
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
    kept.push(question);
  }

  return { kept, dropped };
}
