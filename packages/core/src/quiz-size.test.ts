import { describe, expect, it } from "vitest";
import { fitToBudget, quizBudget, quizSize } from "./quiz-size";
import type { Category } from "./types";

describe("quizSize", () => {
  it("returns zero for an empty bank", () => {
    expect(quizSize(0)).toBe(0);
  });

  it("floors at 8 questions", () => {
    expect(quizSize(1)).toBe(8);
    expect(quizSize(60)).toBe(8);
    expect(quizSize(63)).toBe(8);
  });

  it("scales with the bank", () => {
    expect(quizSize(100)).toBe(12);
    expect(quizSize(159)).toBe(19);
  });

  it("caps at 20 standard questions", () => {
    expect(quizSize(160)).toBe(20);
    expect(quizSize(1000)).toBe(20);
  });
});

describe("fitToBudget", () => {
  const categoryOf = (item: { category: Category }) => item.category;

  it("counts a vocabulary question as half a standard question", () => {
    const items = Array.from({ length: 20 }, () => ({ category: "vocabulary" as const }));
    expect(fitToBudget(items, 8, categoryOf)).toHaveLength(16);
  });

  it("skips an item too heavy for the space left and keeps a lighter one", () => {
    const items: { id: number; category: Category }[] = [
      { id: 1, category: "grammar" },
      { id: 2, category: "vocabulary" },
      { id: 3, category: "grammar" },
      { id: 4, category: "vocabulary" },
    ];
    expect(fitToBudget(items, 2, categoryOf).map((item) => item.id)).toEqual([1, 2, 4]);
  });
});

describe("quizBudget", () => {
  it("scales the quiz size by the length setting", () => {
    expect(quizBudget(100, -1)).toBe(9);
    expect(quizBudget(100, 0)).toBe(12);
    expect(quizBudget(100, 1)).toBe(18);
    expect(quizBudget(160, 2)).toBe(40);
  });

  it("never drops below the minimum usable quiz", () => {
    expect(quizBudget(10, -2)).toBe(5);
  });

  it("treats an unknown setting as standard", () => {
    expect(quizBudget(100, 7)).toBe(12);
  });

  it("returns zero for an empty bank", () => {
    expect(quizBudget(0, 2)).toBe(0);
  });
});
