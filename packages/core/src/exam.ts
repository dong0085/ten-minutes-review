import { shuffled } from "./composition-selection";
import type { PaperSection } from "./paper-sections";
import type { Category } from "./types";

// An exam is a fixed paper worth 100 points, unlocked once a classroom's bank
// is big enough to fill it without leaning on the same few points.
export const EXAM_MIN_POINTS = 80;
export const EXAM_MINUTES = 30;
export const EXAM_MAX_MISSES = 8;
export const EXAM_SPARES_PER_TYPE = 4;

export type ExamQuestionType = "mcq" | "true_false" | "fill_blank";

export const EXAM_BLUEPRINT: readonly {
  section: PaperSection;
  type: ExamQuestionType;
  count: number;
  points: number;
}[] = [
  { section: "choice", type: "mcq", count: 20, points: 2 },
  { section: "true_false", type: "true_false", count: 10, points: 2 },
  { section: "fill_blank", type: "fill_blank", count: 10, points: 4 },
];

export const EXAM_POINTS: Record<PaperSection, number> = {
  choice: 2,
  true_false: 2,
  fill_blank: 4,
};

export const EXAM_QUESTION_COUNT = EXAM_BLUEPRINT.reduce((sum, part) => sum + part.count, 0);

// The categories each question type suits best; any category can fill a type
// when the preferred ones run out.
const PREFERRED_CATEGORIES: Record<ExamQuestionType, readonly Category[]> = {
  true_false: ["grammar", "comprehension", "expression"],
  fill_blank: ["vocabulary", "grammar", "phrase"],
  mcq: ["vocabulary", "phrase", "expression", "comprehension", "grammar"],
};

// Types assigned scarcest-first, so the narrow ones get their best-fitting points.
const ASSIGNMENT_ORDER: readonly ExamQuestionType[] = ["true_false", "fill_blank", "mcq"];

export type ExamSelectablePoint = { id: string; category: Category };

export type ExamSelectionOptions = {
  lastQuizzedAt: ReadonlyMap<string, Date>;
  missedIds: readonly string[];
  random?: () => number;
};

// Picks the points an exam is written from and the question type each gets:
// recent misses first, then the points that have gone longest without a quiz.
// Each type gets its blueprint count plus a few spares, so questions dropped
// during sanitizing still leave a full paper.
export function selectExamPoints<T extends ExamSelectablePoint>(
  bank: readonly T[],
  { lastQuizzedAt, missedIds, random = Math.random }: ExamSelectionOptions,
): { point: T; type: ExamQuestionType }[] {
  const missed = new Set(missedIds);
  const misses = shuffled(
    bank.filter((point) => missed.has(point.id)),
    random,
  ).slice(0, EXAM_MAX_MISSES);
  const missIds = new Set(misses.map((point) => point.id));
  const rest = shuffled(
    bank.filter((point) => !missIds.has(point.id)),
    random,
  ).sort(
    (a, b) =>
      (lastQuizzedAt.get(a.id)?.getTime() ?? -Infinity) -
      (lastQuizzedAt.get(b.id)?.getTime() ?? -Infinity),
  );
  const needed = EXAM_BLUEPRINT.reduce(
    (sum, part) => sum + part.count + EXAM_SPARES_PER_TYPE,
    0,
  );
  const pool = [...misses, ...rest].slice(0, needed);

  const typeById = new Map<string, ExamQuestionType>();
  for (const type of ASSIGNMENT_ORDER) {
    const part = EXAM_BLUEPRINT.find((entry) => entry.type === type);
    let quota = (part?.count ?? 0) + EXAM_SPARES_PER_TYPE;
    const open = () => pool.filter((point) => !typeById.has(point.id));
    const preferred = open().filter((point) =>
      PREFERRED_CATEGORIES[type].includes(point.category),
    );
    for (const point of [...preferred, ...open()]) {
      if (quota === 0) {
        break;
      }
      if (!typeById.has(point.id)) {
        typeById.set(point.id, type);
        quota -= 1;
      }
    }
  }
  return pool.flatMap((point) => {
    const type = typeById.get(point.id);
    return type ? [{ point, type }] : [];
  });
}

// Keeps the first usable questions of each type up to the blueprint count, in
// paper order. Returns null when any part comes up short.
export function fillExamBlueprint<T extends { type: string }>(questions: readonly T[]): T[] | null {
  const paper: T[] = [];
  for (const part of EXAM_BLUEPRINT) {
    const ofType = questions.filter((question) => question.type === part.type).slice(0, part.count);
    if (ofType.length < part.count) {
      return null;
    }
    paper.push(...ofType);
  }
  return paper;
}
