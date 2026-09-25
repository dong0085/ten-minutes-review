import { CATEGORY_WEIGHTS } from "./quiz-size";
import type { Category } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const SELECTION_RECENT_DAYS = 7;
export const SELECTION_RECENT_SHARE = 0.5;
export const SELECTION_MAX_MISSES = 2;
export const SELECTION_SPARE_POINTS = 3;

export type SelectablePoint = { id: string; category: Category; createdAt: Date };

export type SelectionOptions = {
  budget: number;
  now: Date;
  lastQuizzedAt: ReadonlyMap<string, Date>;
  missedIds: readonly string[];
  random?: () => number;
};

export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = result[index] as T;
    result[index] = result[swapIndex] as T;
    result[swapIndex] = value;
  }
  return result;
}

// Picks the knowledge points one quiz is written from, in priority order:
// recent misses, then points added this week, then the points that have gone
// longest without a quiz. Points fill a time budget counted in standard
// questions, so quick vocabulary points make room for more of them. A few spare
// points follow, so questions dropped during sanitizing still leave a full quiz.
export function selectCompositionPoints<T extends SelectablePoint>(
  bank: readonly T[],
  { budget, now, lastQuizzedAt, missedIds, random = Math.random }: SelectionOptions,
): { chosen: T[]; spares: T[] } {
  const chosen: T[] = [];
  const chosenIds = new Set<string>();
  let used = 0;
  const take = (
    candidates: readonly T[],
    { maxCount = Infinity, maxWeight = Infinity }: { maxCount?: number; maxWeight?: number },
  ) => {
    let count = 0;
    let weight = 0;
    for (const point of candidates) {
      const pointWeight = CATEGORY_WEIGHTS[point.category];
      if (
        count < maxCount &&
        weight + pointWeight <= maxWeight &&
        used + pointWeight <= budget &&
        !chosenIds.has(point.id)
      ) {
        chosen.push(point);
        chosenIds.add(point.id);
        count += 1;
        weight += pointWeight;
        used += pointWeight;
      }
    }
  };
  const remaining = () => bank.filter((point) => !chosenIds.has(point.id));

  const missed = new Set(missedIds);
  take(shuffled(bank.filter((point) => missed.has(point.id)), random), {
    maxCount: SELECTION_MAX_MISSES,
  });

  const recentSince = now.getTime() - SELECTION_RECENT_DAYS * DAY_MS;
  take(
    shuffled(remaining().filter((point) => point.createdAt.getTime() >= recentSince), random),
    { maxWeight: budget * SELECTION_RECENT_SHARE },
  );

  const due = shuffled(
    remaining().filter((point) => point.createdAt.getTime() < recentSince),
    random,
  ).sort(
    (a, b) =>
      (lastQuizzedAt.get(a.id)?.getTime() ?? -Infinity) -
      (lastQuizzedAt.get(b.id)?.getTime() ?? -Infinity),
  );
  const poolWeight = (budget - used) * 2;
  let poolSize = 0;
  for (let weight = 0; poolSize < due.length && weight < poolWeight; poolSize += 1) {
    weight += CATEGORY_WEIGHTS[(due[poolSize] as T).category];
  }
  take(shuffled(due.slice(0, poolSize), random), {});
  take(due, {});

  take(shuffled(remaining(), random), {});
  return { chosen, spares: shuffled(remaining(), random).slice(0, SELECTION_SPARE_POINTS) };
}

// Shuffles quiz questions while keeping questions about one passage together.
export function shuffleQuizQuestions<T extends { passageId: string | null }>(
  questions: readonly T[],
  random: () => number = Math.random,
): T[] {
  const groups = new Map<string, T[]>();
  questions.forEach((question, index) => {
    const key = question.passageId ?? `single-${index}`;
    const group = groups.get(key);
    if (group) {
      group.push(question);
    } else {
      groups.set(key, [question]);
    }
  });
  return shuffled([...groups.values()], random).flat();
}
