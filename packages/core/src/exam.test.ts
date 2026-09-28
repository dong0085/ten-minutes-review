import { describe, expect, it } from "vitest";
import {
  EXAM_BLUEPRINT,
  EXAM_POINTS,
  EXAM_QUESTION_COUNT,
  EXAM_SPARES_PER_TYPE,
  fillExamBlueprint,
  selectExamPoints,
} from "./exam";
import { paperParts } from "./paper-sections";
import type { Category } from "./types";

const categories: Category[] = ["vocabulary", "phrase", "grammar", "expression", "comprehension"];
const bank = Array.from({ length: 90 }, (_, index) => ({
  id: `p${index}`,
  category: categories[index % categories.length] as Category,
}));

describe("exam blueprint", () => {
  it("totals 100 points over 40 questions", () => {
    expect(EXAM_QUESTION_COUNT).toBe(40);
    expect(EXAM_BLUEPRINT.reduce((sum, part) => sum + part.count * part.points, 0)).toBe(100);
    const questions = EXAM_BLUEPRINT.flatMap((part) =>
      Array.from({ length: part.count }, () => ({ type: part.type })),
    );
    expect(paperParts(questions, EXAM_POINTS).reduce((sum, part) => sum + part.totalPoints, 0)).toBe(100);
  });
});

describe("selectExamPoints", () => {
  it("gives every type its count plus spares, without repeating a point", () => {
    const picked = selectExamPoints(bank, { lastQuizzedAt: new Map(), missedIds: [] });
    for (const part of EXAM_BLUEPRINT) {
      expect(picked.filter((entry) => entry.type === part.type)).toHaveLength(
        part.count + EXAM_SPARES_PER_TYPE,
      );
    }
    expect(new Set(picked.map((entry) => entry.point.id)).size).toBe(picked.length);
  });

  it("puts recent misses first and prefers fitting categories", () => {
    const picked = selectExamPoints(bank, {
      lastQuizzedAt: new Map(),
      missedIds: ["p3", "p7"],
    });
    expect(picked.map((entry) => entry.point.id)).toEqual(expect.arrayContaining(["p3", "p7"]));
    const trueFalse = picked.filter((entry) => entry.type === "true_false");
    expect(
      trueFalse.every((entry) => ["grammar", "comprehension", "expression"].includes(entry.point.category)),
    ).toBe(true);
  });

  it("skips the most recently quizzed points", () => {
    const lastQuizzedAt = new Map(bank.map((point, index) => [point.id, new Date(2026, 0, 1 + index)]));
    const picked = selectExamPoints(bank, { lastQuizzedAt, missedIds: [] });
    expect(picked.some((entry) => entry.point.id === "p89")).toBe(false);
  });
});

describe("fillExamBlueprint", () => {
  it("keeps questions in paper order and fails when a part is short", () => {
    const questions = EXAM_BLUEPRINT.flatMap((part) =>
      Array.from({ length: part.count + 1 }, (_, index) => ({ type: part.type, index })),
    ).reverse();
    const paper = fillExamBlueprint(questions);
    expect(paper).toHaveLength(40);
    expect(paper?.[0]?.type).toBe("mcq");
    expect(paper?.[39]?.type).toBe("fill_blank");
    expect(fillExamBlueprint(questions.filter((question) => question.type !== "true_false"))).toBeNull();
  });
});
