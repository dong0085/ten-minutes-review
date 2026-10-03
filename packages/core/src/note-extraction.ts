import { matchExcerptToLines, pointKey } from "./note-lines";
import type { NoteEditPlan, StoredNoteLine, WindowLine } from "./note-lines";
import type {
  Category,
  ExtractionDiscard,
  ExtractionKnowledgePoint,
  ExtractionPassage,
  ExtractionResult,
  GrammarDetail,
  RereadResult,
} from "./types";

/** What a re-read changed, shown on the note screen afterwards. */
export type NoteRereadResult = {
  updated: number;
  added: number;
  removed: number;
  /** Hand-edited points whose lines changed; they were kept as they are. */
  keptEditedPointIds: string[];
};

export type ResolvedPassage = {
  targetText: string;
  nativeText: string | null;
  sourceExcerpt: string | null;
  lineIds: string[];
};

export type ResolvedPoint = {
  category: Category;
  targetText: string;
  nativeText: string | null;
  inferred: boolean;
  note: string | null;
  grammar: GrammarDetail | null;
  sourceExcerpt: string | null;
  /** Index into the resolved passages, for comprehension points. */
  passageIndex: number | null;
  lineIds: string[];
};

export type ResolvedExtraction = {
  subject: string | null;
  passages: ResolvedPassage[];
  points: ResolvedPoint[];
  discarded: ExtractionDiscard[];
};

export type ResolvedUpdate = {
  pointId: string;
  targetText: string;
  nativeText: string | null;
  inferred: boolean;
  note: string | null;
  grammar: GrammarDetail | null;
  sourceExcerpt: string | null;
  /** The point's new lines, or null to keep the ones it has. */
  lineIds: string[] | null;
};

export type ResolvedReread = ResolvedExtraction & {
  updates: ResolvedUpdate[];
  removePointIds: string[];
};

/** The note text a point came from, rebuilt from its lines. */
export function excerptFromLines(
  lineIds: readonly string[],
  lines: readonly { id: string; text: string }[],
): string | null {
  const wanted = new Set(lineIds);
  const text = lines
    .filter((line) => wanted.has(line.id))
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join("\n");
  return text || null;
}

function mapLineNumbers(
  numbers: readonly number[] | undefined,
  byNumber: ReadonlyMap<number, string>,
): string[] {
  const ids: string[] = [];
  for (const number of numbers ?? []) {
    const id = byNumber.get(number);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function grammarOf(point: ExtractionKnowledgePoint): GrammarDetail | null {
  return point.category === "grammar" ? point.grammar : null;
}

/**
 * Turns a first reading into rows to save. Each item links to the lines the
 * model cited; when it cited none that exist, the excerpt is matched to a line
 * instead, and an item that matches nothing is saved without lines. Image notes
 * have no lines, so their items are all saved that way.
 */
export function resolveLineExtraction(
  lines: readonly StoredNoteLine[],
  result: ExtractionResult,
): ResolvedExtraction {
  const byNumber = new Map(lines.map((line, index) => [index + 1, line.id] as const));
  const anchor = (item: { lines?: number[]; source_excerpt: string | null }) => {
    const cited = mapLineNumbers(item.lines, byNumber);
    return cited.length > 0 ? cited : matchExcerptToLines(item.source_excerpt, lines);
  };
  const excerpt = (lineIds: string[], fallback: string | null) =>
    excerptFromLines(lineIds, lines) ?? fallback;

  const passages: ResolvedPassage[] = [];
  const passageIndexes = new Map<number, number>();
  result.passages.forEach((passage, index) => {
    const targetText = cleanText(passage.target_text);
    if (!targetText) {
      return;
    }
    const lineIds = anchor(passage);
    passageIndexes.set(index, passages.length);
    passages.push({
      targetText,
      nativeText: passage.native_text,
      sourceExcerpt: excerpt(lineIds, passage.source_excerpt),
      lineIds,
    });
  });

  const points: ResolvedPoint[] = [];
  for (const point of result.knowledge_points) {
    const targetText = cleanText(point.target_text);
    if (!targetText) {
      continue;
    }
    let passageIndex: number | null = null;
    if (point.category === "comprehension") {
      passageIndex = point.passage_ref === null ? null : (passageIndexes.get(point.passage_ref) ?? null);
      if (passageIndex === null) {
        continue;
      }
    }
    const lineIds = anchor(point);
    points.push({
      category: point.category,
      targetText,
      nativeText: point.native_text,
      inferred: point.inferred,
      note: point.note,
      grammar: grammarOf(point),
      sourceExcerpt: excerpt(lineIds, point.source_excerpt),
      passageIndex,
      lineIds,
    });
  }

  return { subject: result.subject, passages, points, discarded: result.discarded };
}

function sameUpdate(update: ResolvedUpdate, point: NoteEditPlan["points"][number]["point"]): boolean {
  return (
    update.lineIds === null &&
    update.targetText === point.targetText &&
    update.nativeText === point.nativeText &&
    update.note === point.note &&
    update.inferred === point.inferred &&
    JSON.stringify(update.grammar) === JSON.stringify(point.grammar)
  );
}

/**
 * Checks a re-reading against the plan it was asked about, and keeps only what
 * the plan allows. Anything doubtful leaves the bank as it was:
 * - an update or removal must name a point the model was shown, and a point
 *   named for both, or updated twice, is left unchanged;
 * - every line number must be one the model was shown;
 * - a new item must come from at least one editable line;
 * - a new point that repeats a point the note keeps is dropped.
 *
 * `keptPointKeys` holds `pointKey` of every live point of the note that the plan
 * neither showed for review nor retires.
 */
export function resolveReread(
  plan: NoteEditPlan,
  result: RereadResult,
  keptPointKeys: Iterable<string>,
): ResolvedReread {
  const window: readonly WindowLine[] = plan.window;
  const byNumber = new Map(window.map((line) => [line.number, line.lineId] as const));
  const editable = new Set(window.filter((line) => line.editable).map((line) => line.lineId));
  const windowLines = window.map((line) => ({ id: line.lineId, text: line.text }));
  const editableLines = windowLines.filter((line) => editable.has(line.id));
  const excerpt = (lineIds: string[], fallback: string | null) =>
    excerptFromLines(lineIds, windowLines) ?? fallback;

  const byRef = new Map(plan.points.map((entry) => [entry.ref, entry.point] as const));
  const updateCounts = new Map<string, number>();
  for (const update of result.updates) {
    updateCounts.set(update.ref, (updateCounts.get(update.ref) ?? 0) + 1);
  }
  const removalRefs = new Set(result.removals);

  const removePointIds: string[] = [];
  for (const ref of removalRefs) {
    const point = byRef.get(ref);
    if (point && !updateCounts.has(ref)) {
      removePointIds.push(point.id);
    }
  }

  const keys = new Set(keptPointKeys);
  const updates: ResolvedUpdate[] = [];
  const updatedIds = new Set<string>();
  for (const update of result.updates) {
    const point = byRef.get(update.ref);
    if (!point || updateCounts.get(update.ref) !== 1 || removalRefs.has(update.ref)) {
      continue;
    }
    const targetText = cleanText(update.target_text);
    if (!targetText) {
      continue;
    }
    const cited = mapLineNumbers(update.lines, byNumber);
    const resolved: ResolvedUpdate = {
      pointId: point.id,
      targetText,
      nativeText: update.native_text,
      inferred: update.inferred,
      note: update.note,
      grammar: point.category === "grammar" ? (update.grammar ?? point.grammar) : null,
      sourceExcerpt: cited.length > 0 ? excerpt(cited, update.source_excerpt) : null,
      lineIds: cited.length > 0 ? cited : null,
    };
    updatedIds.add(point.id);
    keys.add(pointKey(point.category, targetText));
    if (!sameUpdate(resolved, point)) {
      updates.push(resolved);
    }
  }
  // Points shown for review and left out of the reply stay as they are.
  for (const { point } of plan.points) {
    if (!updatedIds.has(point.id) && !removePointIds.includes(point.id)) {
      keys.add(pointKey(point.category, point.targetText));
    }
  }

  const anchorNew = (item: { lines?: number[]; source_excerpt: string | null }) => {
    const cited = mapLineNumbers(item.lines, byNumber);
    if (cited.some((id) => editable.has(id))) {
      return cited;
    }
    return matchExcerptToLines(item.source_excerpt, editableLines);
  };

  const passages: ResolvedPassage[] = [];
  const passageIndexes = new Map<number, number>();
  result.passages.forEach((passage: ExtractionPassage, index) => {
    const targetText = cleanText(passage.target_text);
    const lineIds = anchorNew(passage);
    if (!targetText || lineIds.length === 0) {
      return;
    }
    passageIndexes.set(index, passages.length);
    passages.push({
      targetText,
      nativeText: passage.native_text,
      sourceExcerpt: excerpt(lineIds, passage.source_excerpt),
      lineIds,
    });
  });

  const points: ResolvedPoint[] = [];
  for (const point of result.knowledge_points) {
    const targetText = cleanText(point.target_text);
    if (!targetText) {
      continue;
    }
    const key = pointKey(point.category, targetText);
    if (keys.has(key)) {
      continue;
    }
    let passageIndex: number | null = null;
    if (point.category === "comprehension") {
      passageIndex = point.passage_ref === null ? null : (passageIndexes.get(point.passage_ref) ?? null);
      if (passageIndex === null) {
        continue;
      }
    }
    const lineIds = anchorNew(point);
    if (lineIds.length === 0) {
      continue;
    }
    keys.add(key);
    points.push({
      category: point.category,
      targetText,
      nativeText: point.native_text,
      inferred: point.inferred,
      note: point.note,
      grammar: grammarOf(point),
      sourceExcerpt: excerpt(lineIds, point.source_excerpt),
      passageIndex,
      lineIds,
    });
  }

  return {
    subject: plan.full ? result.subject : null,
    passages,
    points,
    discarded: result.discarded,
    updates,
    removePointIds,
  };
}

/**
 * The note's skipped lines after an edit: earlier entries for lines that are
 * still there and were not re-read, plus what the re-reading skipped.
 */
export function mergeDiscards(
  previous: readonly ExtractionDiscard[],
  fresh: readonly ExtractionDiscard[],
  plan: NoteEditPlan,
): ExtractionDiscard[] {
  if (plan.full) {
    return [...fresh];
  }
  const reread = new Set(plan.window.filter((line) => line.editable).map((line) => line.lineId));
  const untouched = new Set(
    plan.lines
      .filter((line) => !reread.has(line.id))
      .map((line) => line.text.trim().toLowerCase()),
  );
  const kept = previous.filter((entry) => untouched.has(entry.line.trim().toLowerCase()));
  return [...kept, ...fresh];
}

/**
 * Which new points inherit an omit after an image note is read again. Image
 * notes have no lines, so an omit carries over only when exactly one old point
 * and exactly one new point share a category and wording.
 */
export function carriedOmits(
  oldPoints: readonly { category: string; targetText: string; omitted: boolean }[],
  newPoints: readonly { category: string; targetText: string }[],
): Set<number> {
  const oldCounts = new Map<string, { count: number; omitted: boolean }>();
  for (const point of oldPoints) {
    const key = pointKey(point.category, point.targetText);
    const entry = oldCounts.get(key);
    oldCounts.set(key, { count: (entry?.count ?? 0) + 1, omitted: point.omitted });
  }
  const newCounts = new Map<string, number>();
  for (const point of newPoints) {
    const key = pointKey(point.category, point.targetText);
    newCounts.set(key, (newCounts.get(key) ?? 0) + 1);
  }
  const carried = new Set<number>();
  newPoints.forEach((point, index) => {
    const key = pointKey(point.category, point.targetText);
    const old = oldCounts.get(key);
    if (old && old.count === 1 && old.omitted && newCounts.get(key) === 1) {
      carried.add(index);
    }
  });
  return carried;
}
