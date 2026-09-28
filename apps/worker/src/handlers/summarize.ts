import {
  EXAM_POINTS,
  EXAM_REVIEW_PROMPT_V1,
  EXAM_REVIEW_PROMPT_VERSION,
  languageName,
  paperParts,
  parseExamReview,
  toUiLocale,
} from "@tmr/core";
import type { QuestionAnswer, QuestionResponse, UiLocale } from "@tmr/core";
import { getExamReviewInput, saveAttemptReview } from "@tmr/db";
import type { Db } from "@tmr/db";
import { getLlmProvider } from "../llm";
import type { ExamReviewMiss, ExamReviewPayload } from "../llm";

const WRITE_IN: Record<UiLocale, string> = {
  en: "English",
  fr: "French",
  zh: "Simplified Chinese",
};

type SummarizePayload = { attemptId?: unknown };

function optionText(options: string[] | null, index: number | null | undefined): string | null {
  if (index === null || index === undefined) {
    return null;
  }
  return options?.[index] ?? null;
}

/** The learner's answer as plain text, or "(blank)" when they left it. */
export function describeResponse(
  type: ExamReviewMiss["type"],
  options: string[] | null,
  response: QuestionResponse | null,
): string {
  if (type === "mcq") {
    return optionText(options, response?.index) ?? "(blank)";
  }
  if (type === "true_false") {
    return typeof response?.value === "boolean" ? String(response.value) : "(blank)";
  }
  const blanks = (response?.blanks ?? []).map((blank) => blank?.trim() || "(blank)");
  return blanks.length > 0 ? blanks.join(" / ") : "(blank)";
}

export function describeAnswer(
  type: ExamReviewMiss["type"],
  options: string[] | null,
  answer: QuestionAnswer,
): string {
  if (type === "mcq" && "index" in answer) {
    return optionText(options, answer.index) ?? String(answer.index);
  }
  if (type === "true_false" && "value" in answer) {
    return String(answer.value);
  }
  if ("blanks" in answer) {
    return answer.blanks.join(" / ");
  }
  return JSON.stringify(answer);
}

export async function handleSummarizeJob(db: Db, payload: SummarizePayload): Promise<void> {
  const attemptId = typeof payload.attemptId === "string" ? payload.attemptId : null;
  if (!attemptId) {
    throw new Error("summarize job is missing attemptId");
  }
  const input = await getExamReviewInput(db, attemptId);
  if (!input || input.quizKind !== "exam" || input.attempt.review) {
    return;
  }

  const parts = paperParts(input.answers, EXAM_POINTS);
  const misses: ExamReviewMiss[] = [];
  let earned = 0;
  let total = 0;
  for (const part of parts) {
    total += part.totalPoints;
    for (const { question, number } of part.questions) {
      if (question.isCorrect) {
        earned += part.pointsEach;
        continue;
      }
      const type = question.type as ExamReviewMiss["type"];
      misses.push({
        number,
        type,
        category: question.category,
        knowledgePoint: { target: question.pointTarget, native: question.pointNative },
        stem: question.stem,
        options: question.options,
        learnerAnswer: describeResponse(type, question.options, question.response),
        rightAnswer: describeAnswer(type, question.options, question.answer),
        explanation: question.explanation,
      });
    }
  }
  if (misses.length === 0) {
    return;
  }

  const reviewPayload: ExamReviewPayload = {
    targetLanguage: languageName(input.targetLanguage) ?? input.targetLanguage,
    nativeLanguage: languageName(input.nativeLanguage) ?? input.nativeLanguage,
    writeIn: WRITE_IN[toUiLocale(input.uiLanguage)],
    score: { earned, total },
    parts: parts.map((part) => ({
      type: part.section,
      correct: part.questions.filter(({ question }) => question.isCorrect).length,
      count: part.questions.length,
    })),
    misses,
  };
  const raw = await getLlmProvider().summarize({
    systemPrompt: EXAM_REVIEW_PROMPT_V1,
    payload: reviewPayload,
  });
  const review = parseExamReview(
    raw,
    misses.map((miss) => miss.number),
  );
  await saveAttemptReview(db, attemptId, review, EXAM_REVIEW_PROMPT_VERSION);
}
