import { ATTEMPT_TTL_MS } from "@tmr/core";
import type { LocalResponse } from "@/components/quiz/types";


export type QuizOptionOrders = Record<string, number[]>;

export type QuizDraft = {
  version: 1;
  attemptToken: string;
  startedAt: number;
  questionStartedAt: number;
  responses: Record<string, LocalResponse>;
  current: number;
  durations: Record<string, number>;
  optionOrders?: QuizOptionOrders;
  savedAt: number;
};

function storageKey(userId: string, quizId: string): string {
  return `tmr:quiz-draft:${userId}:${quizId}`;
}

function optionOrdersStorageKey(userId: string, quizId: string): string {
  return `tmr:quiz-option-orders:${userId}:${quizId}`;
}

function isQuizOptionOrders(value: unknown): value is QuizOptionOrders {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (order) => Array.isArray(order) && order.every((index) => Number.isInteger(index)),
    )
  );
}

function isQuizDraft(value: unknown): value is QuizDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
  const draft = value as Partial<QuizDraft>;
  return (
    draft.version === 1 &&
    typeof draft.attemptToken === "string" &&
    typeof draft.startedAt === "number" &&
    typeof draft.questionStartedAt === "number" &&
    typeof draft.current === "number" &&
    typeof draft.savedAt === "number" &&
    typeof draft.responses === "object" &&
    draft.responses !== null &&
    typeof draft.durations === "object" &&
    draft.durations !== null &&
    (draft.optionOrders === undefined || isQuizOptionOrders(draft.optionOrders))
  );
}

export function loadQuizDraft(userId: string, quizId: string): QuizDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(userId, quizId));
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isQuizDraft(parsed) || Date.now() - parsed.savedAt > ATTEMPT_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveQuizDraft(userId: string, quizId: string, draft: QuizDraft): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(userId, quizId), JSON.stringify(draft));
  } catch {
    return;
  }
}

export function clearQuizDraft(userId: string, quizId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(storageKey(userId, quizId));
  } catch {
    return;
  }
}

export function loadQuizOptionOrders(userId: string, quizId: string): QuizOptionOrders {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(optionOrdersStorageKey(userId, quizId));
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return isQuizOptionOrders(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveQuizOptionOrders(
  userId: string,
  quizId: string,
  optionOrders: QuizOptionOrders,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      optionOrdersStorageKey(userId, quizId),
      JSON.stringify(optionOrders),
    );
  } catch {
    return;
  }
}
