import type { Category, GrammarDetail } from "./types";

/** Free users may edit or re-read each note this many times; Pro has no per-note cap. */
export const FREE_NOTE_REREADS = 3;

/** Unchanged lines shown around an edit, so the model reads the edit in context. */
export const NOTE_CONTEXT_LINES = 2;

// Above this many cell comparisons the diff stops looking for matches inside the
// edited region and treats the whole region as changed. Real notes stay far below it.
const MAX_DIFF_CELLS = 4_000_000;

/** Splits note text into lines. Blank lines are kept, so joining them gives the text back. */
export function splitNoteLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

export function joinNoteLines(lines: readonly string[]): string {
  return lines.join("\n");
}

function lineKey(line: string): string {
  return line.trimEnd();
}

export type LineChange =
  | { kind: "same"; oldIndex: number; newIndex: number }
  | { kind: "changed"; oldIndex: number; newIndex: number }
  | { kind: "removed"; oldIndex: number }
  | { kind: "added"; newIndex: number };

/**
 * Line diff between two versions of a note. Lines that match keep their place;
 * between two matches, removed and added lines pair up in order as "changed"
 * (an edited line), and whatever is left over is plainly removed or added.
 */
export function diffNoteLines(oldLines: readonly string[], newLines: readonly string[]): LineChange[] {
  const oldKeys = oldLines.map(lineKey);
  const newKeys = newLines.map(lineKey);

  let prefix = 0;
  while (prefix < oldKeys.length && prefix < newKeys.length && oldKeys[prefix] === newKeys[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < oldKeys.length - prefix &&
    suffix < newKeys.length - prefix &&
    oldKeys[oldKeys.length - 1 - suffix] === newKeys[newKeys.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const oldMiddle = oldKeys.slice(prefix, oldKeys.length - suffix);
  const newMiddle = newKeys.slice(prefix, newKeys.length - suffix);
  const pairs = matchMiddle(oldMiddle, newMiddle);

  const changes: LineChange[] = [];
  for (let index = 0; index < prefix; index += 1) {
    changes.push({ kind: "same", oldIndex: index, newIndex: index });
  }

  let oldCursor = 0;
  let newCursor = 0;
  const flushGap = (oldEnd: number, newEnd: number) => {
    const removed = oldEnd - oldCursor;
    const added = newEnd - newCursor;
    const paired = Math.min(removed, added);
    for (let offset = 0; offset < paired; offset += 1) {
      changes.push({
        kind: "changed",
        oldIndex: prefix + oldCursor + offset,
        newIndex: prefix + newCursor + offset,
      });
    }
    for (let offset = paired; offset < removed; offset += 1) {
      changes.push({ kind: "removed", oldIndex: prefix + oldCursor + offset });
    }
    for (let offset = paired; offset < added; offset += 1) {
      changes.push({ kind: "added", newIndex: prefix + newCursor + offset });
    }
  };
  for (const [oldIndex, newIndex] of pairs) {
    flushGap(oldIndex, newIndex);
    changes.push({ kind: "same", oldIndex: prefix + oldIndex, newIndex: prefix + newIndex });
    oldCursor = oldIndex + 1;
    newCursor = newIndex + 1;
  }
  flushGap(oldMiddle.length, newMiddle.length);

  for (let offset = suffix; offset > 0; offset -= 1) {
    changes.push({
      kind: "same",
      oldIndex: oldKeys.length - offset,
      newIndex: newKeys.length - offset,
    });
  }
  return changes;
}

// Longest common subsequence of two line lists, as [oldIndex, newIndex] pairs.
// Blank lines never anchor a match: they would pair unrelated edits around them.
function matchMiddle(oldKeys: string[], newKeys: string[]): [number, number][] {
  const rows = oldKeys.length;
  const cols = newKeys.length;
  if (rows === 0 || cols === 0 || rows * cols > MAX_DIFF_CELLS) {
    return [];
  }
  const table = new Uint32Array((rows + 1) * (cols + 1));
  const cell = (row: number, col: number) => table[row * (cols + 1) + col] ?? 0;
  const anchors = (row: number, col: number) =>
    oldKeys[row] === newKeys[col] && (oldKeys[row] ?? "").trim() !== "";
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let col = cols - 1; col >= 0; col -= 1) {
      table[row * (cols + 1) + col] = anchors(row, col)
        ? cell(row + 1, col + 1) + 1
        : Math.max(cell(row + 1, col), cell(row, col + 1));
    }
  }
  const pairs: [number, number][] = [];
  let row = 0;
  let col = 0;
  while (row < rows && col < cols) {
    if (anchors(row, col)) {
      pairs.push([row, col]);
      row += 1;
      col += 1;
    } else if (cell(row + 1, col) >= cell(row, col + 1)) {
      row += 1;
    } else {
      col += 1;
    }
  }
  return pairs;
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Finds the lines a free-text excerpt came from, for points saved before lines
 * existed and as a fallback when the model leaves out line numbers. Exact line
 * matches win; then lines containing the excerpt; then, for an excerpt spanning
 * several lines, the lines it contains. An ambiguous match links nothing.
 */
export function matchExcerptToLines(
  excerpt: string | null | undefined,
  lines: readonly { id: string; text: string }[],
): string[] {
  const target = normalizeForMatch(excerpt ?? "");
  if (target.length < 2) {
    return [];
  }
  const normalized = lines.map((line) => ({ id: line.id, text: normalizeForMatch(line.text) }));
  const exact = normalized.filter((line) => line.text === target);
  if (exact.length > 0) {
    return exact.length === 1 ? exact.map((line) => line.id) : [];
  }
  const containing = normalized.filter((line) => line.text.length > 0 && line.text.includes(target));
  if (containing.length > 0) {
    return containing.length === 1 ? containing.map((line) => line.id) : [];
  }
  return normalized
    .filter((line) => line.text.length >= 3 && target.includes(line.text))
    .map((line) => line.id);
}

export type StoredNoteLine = { id: string; text: string };

export type StoredNotePoint = {
  id: string;
  category: Category;
  targetText: string;
  nativeText: string | null;
  note: string | null;
  inferred: boolean;
  grammar: GrammarDetail | null;
  /** The passage a comprehension point hangs off, else null. */
  passageId: string | null;
  lineIds: string[];
  userEdited: boolean;
};

export type StoredNotePassage = { id: string; lineIds: string[] };

export type WindowLine = {
  /** 1-based position in the edited note; what the model cites. */
  number: number;
  lineId: string;
  text: string;
  /** New points may come from editable lines; the rest is context. */
  editable: boolean;
};

export type NoteEditPlan = {
  /** The note's lines after the edit, in order. Kept lines reuse their id. */
  lines: StoredNoteLine[];
  /** Line ids the note had before the edit, used to detect a concurrent change. */
  baseLineIds: string[];
  removedLineIds: string[];
  /** Lines shown to the model; empty when the edit needs no reading (only deletions). */
  window: WindowLine[];
  /** Points the model may update or remove, by the short ref it sees. */
  points: { ref: string; point: StoredNotePoint }[];
  /** Points the model sees so it does not repeat them, but may not change. */
  contextPoints: StoredNotePoint[];
  /** Points that lose every line they came from: replaced without asking the model. */
  retirePointIds: string[];
  /** Passages touched by the edit: replaced, with their comprehension points. */
  retirePassageIds: string[];
  /** Hand-edited points whose lines changed. They stay as they are. */
  keptEditedPointIds: string[];
  full: boolean;
};

export type PlanNoteEditInput = {
  lines: readonly StoredNoteLine[];
  /** The edited text, or null to re-read the note as it stands. */
  newText: string | null;
  points: readonly StoredNotePoint[];
  passages: readonly StoredNotePassage[];
  newId: () => string;
  contextLines?: number;
};

/**
 * Works out what an edit touches by following each point's links to its lines.
 * Points whose lines are all unchanged are left alone; points on changed lines
 * go to the model; points whose lines are all gone are replaced. A full re-read
 * treats every line as changed.
 */
export function planNoteEdit(input: PlanNoteEditInput): NoteEditPlan {
  const full = input.newText === null;
  const oldTexts = input.lines.map((line) => line.text);
  const newTexts = full ? oldTexts : splitNoteLines(input.newText ?? "");
  const changes = diffNoteLines(oldTexts, newTexts);

  const finalLines: StoredNoteLine[] = new Array(newTexts.length);
  const touchedOldIds = new Set<string>();
  const dirtyIds = new Set<string>();
  const removedLineIds: string[] = [];
  const oldId = (index: number) => input.lines[index]?.id ?? "";
  const newText = (index: number) => newTexts[index] ?? "";
  for (const change of changes) {
    if (change.kind === "same" || change.kind === "changed") {
      const id = oldId(change.oldIndex);
      finalLines[change.newIndex] = { id, text: newText(change.newIndex) };
      if (change.kind === "changed") {
        touchedOldIds.add(id);
        dirtyIds.add(id);
      }
    } else if (change.kind === "removed") {
      const id = oldId(change.oldIndex);
      touchedOldIds.add(id);
      removedLineIds.push(id);
    } else {
      const id = input.newId();
      finalLines[change.newIndex] = { id, text: newText(change.newIndex) };
      dirtyIds.add(id);
    }
  }
  if (full) {
    for (const line of finalLines) {
      touchedOldIds.add(line.id);
      dirtyIds.add(line.id);
    }
  }
  const removed = new Set(removedLineIds);
  const surviving = (lineIds: readonly string[]) => lineIds.filter((id) => !removed.has(id));
  const isTouched = (lineIds: readonly string[]) => lineIds.some((id) => touchedOldIds.has(id));

  const editableIds = new Set(dirtyIds);
  const retirePassageIds: string[] = [];
  for (const passage of input.passages) {
    if (full || isTouched(passage.lineIds)) {
      retirePassageIds.push(passage.id);
      for (const id of surviving(passage.lineIds)) {
        editableIds.add(id);
      }
    }
  }
  const retiredPassages = new Set(retirePassageIds);

  const sent: StoredNotePoint[] = [];
  const contextPoints: StoredNotePoint[] = [];
  const retirePointIds: string[] = [];
  const keptEditedPointIds: string[] = [];
  for (const point of input.points) {
    const touched = full || isTouched(point.lineIds);
    if (point.userEdited) {
      if (touched) {
        keptEditedPointIds.push(point.id);
      }
      contextPoints.push(point);
      continue;
    }
    if (point.category === "comprehension" && point.passageId) {
      if (retiredPassages.has(point.passageId)) {
        retirePointIds.push(point.id);
      }
      continue;
    }
    if (point.lineIds.length === 0) {
      // Saved before lines existed and matched to none: only a full re-read reviews it.
      (full ? sent : contextPoints).push(point);
      continue;
    }
    if (!touched) {
      contextPoints.push(point);
      continue;
    }
    const kept = surviving(point.lineIds);
    if (kept.length === 0) {
      retirePointIds.push(point.id);
      continue;
    }
    sent.push(point);
    for (const id of kept) {
      editableIds.add(id);
    }
  }

  const window: WindowLine[] = [];
  if (editableIds.size > 0) {
    const radius = input.contextLines ?? NOTE_CONTEXT_LINES;
    const shown = new Set<number>();
    finalLines.forEach((line, index) => {
      if (editableIds.has(line.id)) {
        for (let near = index - radius; near <= index + radius; near += 1) {
          if (near >= 0 && near < finalLines.length) {
            shown.add(near);
          }
        }
      }
    });
    finalLines.forEach((line, index) => {
      if (shown.has(index)) {
        window.push({
          number: index + 1,
          lineId: line.id,
          text: line.text,
          editable: editableIds.has(line.id),
        });
      }
    });
  }
  const hasEditableText = window.some((line) => line.editable && line.text.trim() !== "");
  const windowIds = new Set(window.map((line) => line.lineId));

  return {
    lines: finalLines,
    baseLineIds: input.lines.map((line) => line.id),
    removedLineIds,
    window: hasEditableText || sent.length > 0 ? window : [],
    points: sent.map((point, index) => ({ ref: `p${index + 1}`, point })),
    contextPoints: contextPoints.filter(
      (point) => point.lineIds.length === 0 || point.lineIds.some((id) => windowIds.has(id)),
    ),
    retirePointIds,
    retirePassageIds,
    keptEditedPointIds,
    full,
  };
}

/** The bank-level identity of a point, used to avoid saving the same item twice. */
export function pointKey(category: string, targetText: string): string {
  return `${category}|${normalizeForMatch(targetText)}`;
}

/** Above this length a line likely holds several items; the upload preview flags it. */
export const LONG_NOTE_LINE = 160;

export type NotePreview = {
  /** The lines exactly as the server will number them, blank ones included. */
  lines: string[];
  /** Lines with text: what the reading covers. */
  filledCount: number;
  /** 0-based indexes of lines long enough to be worth splitting. */
  longLines: number[];
};

/** What the server will read from pasted notes, so the learner can check it first. */
export function previewNoteLines(text: string): NotePreview {
  const lines = splitNoteLines(text.trim());
  const longLines: number[] = [];
  lines.forEach((line, index) => {
    if (line.trim().length > LONG_NOTE_LINE && splitNoteLine(line).length > 1) {
      longLines.push(index);
    }
  });
  return {
    lines,
    filledCount: lines.filter((line) => line.trim() !== "").length,
    longLines,
  };
}

// Breaks that separate items in pasted notes. " - " and ":" are left alone:
// in notes they usually join a term to its meaning.
const ITEM_BREAK = /\s*;\s*|\s*[•·▪●]\s*|(?<=[.!?。！？])\s+/u;

/** Splits one line at semicolons, bullets, and sentence ends. */
export function splitNoteLine(line: string): string[] {
  return line
    .split(ITEM_BREAK)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Splits every long line of the notes; short lines are left as they are. */
export function splitLongNoteLines(text: string): string {
  const preview = previewNoteLines(text);
  const long = new Set(preview.longLines);
  return joinNoteLines(
    preview.lines.flatMap((line, index) => (long.has(index) ? splitNoteLine(line) : [line])),
  );
}
