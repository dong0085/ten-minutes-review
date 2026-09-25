import { MIN_USABLE_QUESTIONS } from "./constants";
import type { Category } from "./types";

// The quiz's time budget, counted in standard questions.
export function quizSize(bankSize: number): number {
  if (bankSize <= 0) {
    return 0;
  }
  return Math.min(20, Math.max(8, Math.floor(bankSize / 8)));
}

// A classroom's quiz length setting, from -2 (much shorter) to 2 (much longer).
export const QUIZ_LENGTHS = [-2, -1, 0, 1, 2] as const;

export type QuizLength = (typeof QUIZ_LENGTHS)[number];

export const QUIZ_LENGTH_MULTIPLIERS: Record<QuizLength, number> = {
  [-2]: 0.5,
  [-1]: 0.75,
  0: 1,
  1: 1.5,
  2: 2,
};

export function isQuizLength(value: unknown): value is QuizLength {
  return QUIZ_LENGTHS.includes(value as QuizLength);
}

// The quiz size scaled by the classroom's length setting. It never drops below
// the minimum a quiz needs to be sent.
export function quizBudget(bankSize: number, quizLength: number): number {
  if (bankSize <= 0) {
    return 0;
  }
  const multiplier = isQuizLength(quizLength) ? QUIZ_LENGTH_MULTIPLIERS[quizLength] : 1;
  return Math.max(MIN_USABLE_QUESTIONS, Math.round(quizSize(bankSize) * multiplier));
}

// How much of the budget one question in each category uses. A vocabulary
// question is quick to answer, so a quiz holds two of them per standard slot.
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  vocabulary: 0.5,
  phrase: 1,
  grammar: 1,
  expression: 1,
  comprehension: 1,
};

// Keeps items in order while they fit the budget; an item too heavy for the
// space left is skipped so a lighter one after it can still fit.
export function fitToBudget<T>(
  items: readonly T[],
  budget: number,
  categoryOf: (item: T) => Category,
): T[] {
  const kept: T[] = [];
  let used = 0;
  for (const item of items) {
    const weight = CATEGORY_WEIGHTS[categoryOf(item)];
    if (used + weight <= budget) {
      kept.push(item);
      used += weight;
    }
  }
  return kept;
}
