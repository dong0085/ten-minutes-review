import { describe, expect, it } from "vitest";
import {
  SELECTION_SPARE_POINTS,
  selectCompositionPoints,
  shuffleQuizQuestions,
} from "./composition-selection";
import type { Category } from "./types";

const NOW = new Date("2026-09-25T11:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function point(id: string, daysAgo: number, category: Category = "phrase") {
  return { id, category, createdAt: new Date(NOW.getTime() - daysAgo * DAY_MS) };
}

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const recent = Array.from({ length: 20 }, (_, index) => point(`new-${index}`, 1));
const old = Array.from({ length: 40 }, (_, index) => point(`old-${index}`, 30 + index));

describe("selectCompositionPoints", () => {
  it("returns every point when the bank is small", () => {
    const { chosen, spares } = selectCompositionPoints([point("a", 1), point("b", 20)], {
      budget: 8,
      now: NOW,
      lastQuizzedAt: new Map(),
      missedIds: [],
    });
    expect(chosen.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(spares).toEqual([]);
  });

  it("puts misses first, then about half recent, then older points", () => {
    const { chosen, spares } = selectCompositionPoints([...recent, ...old], {
      budget: 10,
      now: NOW,
      lastQuizzedAt: new Map(),
      missedIds: ["old-5", "old-6", "old-7"],
      random: seeded(1),
    });
    const ids = chosen.map((p) => p.id);
    expect(ids).toHaveLength(10);
    expect(spares).toHaveLength(SELECTION_SPARE_POINTS);
    expect(new Set([...ids, ...spares.map((p) => p.id)]).size).toBe(10 + SELECTION_SPARE_POINTS);
    expect(ids.slice(0, 2).every((id) => ["old-5", "old-6", "old-7"].includes(id))).toBe(true);
    expect(ids.filter((id) => id.startsWith("new-"))).toHaveLength(5);
    expect(ids.slice(7).every((id) => id.startsWith("old-"))).toBe(true);
  });

  it("fits two vocabulary points in each standard slot", () => {
    const vocabulary = Array.from({ length: 40 }, (_, index) =>
      point(`vocab-${index}`, 30 + index, "vocabulary"),
    );
    const { chosen } = selectCompositionPoints(vocabulary, {
      budget: 8,
      now: NOW,
      lastQuizzedAt: new Map(),
      missedIds: [],
      random: seeded(6),
    });
    expect(chosen).toHaveLength(16);
  });

  it("mixes vocabulary and other points within the budget", () => {
    const mixed = Array.from({ length: 40 }, (_, index) =>
      point(`mixed-${index}`, 30 + index, index % 2 === 0 ? "vocabulary" : "grammar"),
    );
    const { chosen } = selectCompositionPoints(mixed, {
      budget: 8,
      now: NOW,
      lastQuizzedAt: new Map(),
      missedIds: [],
      random: seeded(7),
    });
    const weight = chosen.reduce((sum, p) => sum + (p.category === "vocabulary" ? 0.5 : 1), 0);
    expect(weight).toBe(8);
  });

  it("brings back the older points that have waited longest for a quiz", () => {
    const lastQuizzedAt = new Map(
      old.slice(0, 20).map((p) => [p.id, new Date(NOW.getTime() - DAY_MS)]),
    );
    const { chosen } = selectCompositionPoints(old, {
      budget: 5,
      now: NOW,
      lastQuizzedAt,
      missedIds: [],
      random: seeded(2),
    });
    expect(chosen.every((p) => Number(p.id.slice(4)) >= 20)).toBe(true);
  });

  it("fills with recent points when there are no older ones", () => {
    const { chosen, spares } = selectCompositionPoints(recent, {
      budget: 10,
      now: NOW,
      lastQuizzedAt: new Map(),
      missedIds: [],
      random: seeded(3),
    });
    expect(chosen).toHaveLength(10);
    expect(spares).toHaveLength(SELECTION_SPARE_POINTS);
  });

  it("varies the pick from one day to the next", () => {
    const pick = (seed: number) =>
      selectCompositionPoints([...recent, ...old], {
        budget: 10,
        now: NOW,
        lastQuizzedAt: new Map(),
        missedIds: [],
        random: seeded(seed),
      }).chosen.map((p) => p.id);
    expect(pick(4)).not.toEqual(pick(5));
  });
});

describe("shuffleQuizQuestions", () => {
  it("keeps questions about one passage next to each other", () => {
    const questions = [
      { id: 1, passageId: null },
      { id: 2, passageId: "p" },
      { id: 3, passageId: null },
      { id: 4, passageId: "p" },
      { id: 5, passageId: null },
    ];
    for (let seed = 1; seed < 20; seed += 1) {
      const order = shuffleQuizQuestions(questions, seeded(seed)).map((q) => q.id);
      expect([...order].sort()).toEqual([1, 2, 3, 4, 5]);
      expect(Math.abs(order.indexOf(2) - order.indexOf(4))).toBe(1);
    }
  });
});
