import type { QuestionAnswer, QuestionResponse, QuestionType } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeAnswerText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*[.!?…]+$/u, "");
}

export function gradeAnswer(
  type: QuestionType,
  answer: QuestionAnswer,
  response: unknown,
): boolean {
  if (!isRecord(response)) {
    return false;
  }

  if (type === "mcq" || type === "image") {
    const expected = (answer as { index?: unknown }).index;
    return typeof response.index === "number" && response.index === expected;
  }

  if (type === "true_false") {
    const expected = (answer as { value?: unknown }).value;
    return typeof response.value === "boolean" && response.value === expected;
  }

  const expectedBlanks = (answer as { blanks?: unknown }).blanks;
  const accepted = (answer as { accepted?: unknown }).accepted;
  const actualBlanks = response.blanks;
  if (!Array.isArray(expectedBlanks) || !Array.isArray(actualBlanks)) {
    return false;
  }
  if (expectedBlanks.length !== actualBlanks.length || expectedBlanks.length === 0) {
    return false;
  }
  return expectedBlanks.every((expected, index) => {
    const actual = actualBlanks[index];
    if (typeof expected !== "string" || typeof actual !== "string") {
      return false;
    }
    const alternatives = Array.isArray(accepted) && Array.isArray(accepted[index]) ? accepted[index] : [];
    const given = normalizeAnswerText(actual);
    return [expected, ...alternatives].some(
      (option) => typeof option === "string" && normalizeAnswerText(option) === given,
    );
  });
}

export function gradeAttempt(
  questions: { id: string; type: QuestionType; answer: QuestionAnswer }[],
  responses: Map<string, unknown>,
): { correctCount: number; questionCount: number; results: { questionId: string; isCorrect: boolean }[] } {
  const results = questions.map((question) => ({
    questionId: question.id,
    isCorrect: gradeAnswer(question.type, question.answer, responses.get(question.id)),
  }));
  return {
    correctCount: results.filter((result) => result.isCorrect).length,
    questionCount: questions.length,
    results,
  };
}

export function emptyResponseFor(type: QuestionType): QuestionResponse {
  if (type === "fill_blank") {
    return { blanks: [] };
  }
  if (type === "true_false") {
    return { value: null };
  }
  return { index: null };
}
