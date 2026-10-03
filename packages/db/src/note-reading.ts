import { eq } from "drizzle-orm";
import {
  EXTRACTION_PROMPT_V3,
  EXTRACTION_PROMPT_VERSION,
  REREAD_PROMPT_V1,
  REREAD_PROMPT_VERSION,
  buildRereadPayload,
  carriedOmits,
  matchExcerptToLines,
  mergeDiscards,
  parseExtractionResult,
  parseRereadResult,
  planNoteEdit,
  pointKey,
  renderNumberedLines,
  resolveLineExtraction,
  resolveReread,
  splitNoteLines,
} from "@tmr/core";
import type {
  GrammarDetail,
  KnowledgePointDetail,
  NoteRereadResult,
  ResolvedExtraction,
  StoredNotePoint,
} from "@tmr/core";
import type { Db } from "./client";
import { classrooms } from "./schema/classrooms";
import type { Upload } from "./schema/classrooms";
import type { KnowledgePoint } from "./schema/bank";
import { failUploadExtraction, getUploadById, markUploadRunning } from "./repos/classrooms";
import {
  failReread,
  listNoteLines,
  listNotePassages,
  listNotePoints,
  markRereadRunning,
  saveFirstReading,
  saveReread,
} from "./repos/notes";
import type { NewNotePoint, NoteLinkRow, NoteWrite } from "./repos/notes";

export type NoteReaderImage = { bytes: Uint8Array; mimeType: string };

/** What reading a note needs from the app: its LLM adapter and its image storage. */
export type NoteReaderDeps = {
  extract(input: {
    systemPrompt: string;
    text?: string | null;
    images?: NoteReaderImage[];
    targetHint?: string | null;
  }): Promise<unknown>;
  loadImage(storageKey: string): Promise<NoteReaderImage>;
};

function normalizeSubject(value: string | null): string | null {
  const subject = value?.replace(/\s+/g, " ").trim();
  return subject ? subject.slice(0, 120) : null;
}

function grammarOf(point: KnowledgePoint): GrammarDetail | null {
  const detail = point.detail as { grammar?: GrammarDetail } | null;
  return detail?.grammar ?? null;
}

function passageIdOf(point: KnowledgePoint): string | null {
  const detail = point.detail as { passage_ref?: unknown } | null;
  return typeof detail?.passage_ref === "string" ? detail.passage_ref : null;
}

function asJson(raw: unknown): unknown {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function languagesFor(db: Db, classroomId: string) {
  const [classroom] = await db
    .select({ target: classrooms.targetLanguage, native: classrooms.nativeLanguage })
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);
  return { target: classroom?.target ?? null, native: classroom?.native ?? null };
}

async function readImage(upload: Upload, deps: NoteReaderDeps): Promise<NoteReaderImage[]> {
  if (!upload.storageKey) {
    throw new Error(`image upload ${upload.id} has no storage key`);
  }
  const object = await deps.loadImage(upload.storageKey);
  return [{ bytes: object.bytes, mimeType: upload.mimeType ?? object.mimeType }];
}

// New rows for a resolved reading. Passage ids are made here so points and lines
// can refer to them inside the same transaction.
function newRows(
  resolved: ResolvedExtraction,
  omittedIndexes: Set<number> = new Set(),
): Pick<NoteWrite, "passages" | "points"> {
  const passages = resolved.passages.map((passage) => ({ id: crypto.randomUUID(), ...passage }));
  const points: NewNotePoint[] = resolved.points.map((point, index) => {
    let detail: KnowledgePointDetail = null;
    if (point.grammar) {
      detail = { grammar: point.grammar };
    }
    if (point.passageIndex !== null) {
      const passage = passages[point.passageIndex];
      detail = passage ? ({ passage_ref: passage.id } as unknown as KnowledgePointDetail) : null;
    }
    return {
      category: point.category,
      targetText: point.targetText,
      nativeText: point.nativeText,
      inferred: point.inferred,
      note: point.note,
      detail,
      sourceExcerpt: point.sourceExcerpt,
      lineIds: point.lineIds,
      omitted: omittedIndexes.has(index),
    };
  });
  return { passages, points };
}

/**
 * A note's first reading: typed notes are split into numbered lines and every
 * point links to the lines it came from. Safe to run twice.
 */
export async function readNewNote(db: Db, uploadId: string, deps: NoteReaderDeps) {
  const upload = await getUploadById(db, uploadId);
  if (!upload) {
    throw new Error(`upload ${uploadId} not found`);
  }
  if (upload.extractionStatus === "done") {
    return { points: 0, discarded: 0 };
  }
  try {
    await markUploadRunning(db, uploadId);
    const languages = await languagesFor(db, upload.classroomId);
    const lines =
      upload.kind === "text"
        ? splitNoteLines(upload.textContent ?? "").map((text) => ({ id: crypto.randomUUID(), text }))
        : [];
    const raw = await deps.extract({
      systemPrompt: EXTRACTION_PROMPT_V3,
      text: upload.kind === "text" ? renderNumberedLines(lines) : null,
      images: upload.kind === "image" ? await readImage(upload, deps) : [],
      targetHint: languages.target,
    });
    const resolved = resolveLineExtraction(lines, parseExtractionResult(asJson(raw)));
    const write: NoteWrite = {
      uploadId,
      classroomId: upload.classroomId,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      lines,
      removedLineIds: [],
      baseLineIds: [],
      seedPointLinks: [],
      seedPassageLinks: [],
      retirePointIds: [],
      retirePassageIds: [],
      updates: [],
      ...newRows(resolved),
    };
    await saveFirstReading(db, write, {
      discarded: resolved.discarded,
      subject: normalizeSubject(resolved.subject),
    });
    return { points: write.points.length, discarded: resolved.discarded.length };
  } catch (error) {
    await failUploadExtraction(db, uploadId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Reads an edited note again. Only points on changed lines go to the model;
 * the rest keep their row, history, and hand edits. Returns null when the
 * request went stale (a newer one replaced it, or it was discarded).
 */
export async function rereadNote(
  db: Db,
  uploadId: string,
  rereadId: string,
  deps: NoteReaderDeps,
): Promise<NoteRereadResult | null> {
  if (!(await markRereadRunning(db, uploadId, rereadId))) {
    return null;
  }
  try {
    const upload = await getUploadById(db, uploadId);
    if (!upload) {
      return null;
    }
    return upload.kind === "image"
      ? await rereadImageNote(db, upload, rereadId, deps)
      : await rereadTextNote(db, upload, rereadId, deps);
  } catch (error) {
    await failReread(db, uploadId, rereadId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function rereadTextNote(db: Db, upload: Upload, rereadId: string, deps: NoteReaderDeps) {
  const [storedLines, pointRows, passageRows] = await Promise.all([
    listNoteLines(db, upload.id),
    listNotePoints(db, upload.id),
    listNotePassages(db, upload.id),
  ]);

  // Notes read before lines existed get their lines now, and their points are
  // linked by matching each excerpt to a line. Points that match none stay unlinked.
  const legacy = storedLines.length === 0;
  const lines = legacy
    ? splitNoteLines(upload.textContent ?? "").map((text) => ({ id: crypto.randomUUID(), text }))
    : storedLines;
  const seedPointLinks: NoteLinkRow[] = legacy
    ? pointRows.map(({ point }) => ({ ownerId: point.id, lineIds: matchExcerptToLines(point.sourceExcerpt, lines) }))
    : [];
  const seedPassageLinks: NoteLinkRow[] = legacy
    ? passageRows.map((passage) => ({ ownerId: passage.id, lineIds: matchExcerptToLines(passage.sourceExcerpt, lines) }))
    : [];
  const seeded = new Map([...seedPointLinks, ...seedPassageLinks].map((link) => [link.ownerId, link.lineIds]));

  const points: StoredNotePoint[] = pointRows.map(({ point, lineIds }) => ({
    id: point.id,
    category: point.category,
    targetText: point.targetText,
    nativeText: point.nativeText,
    note: point.note,
    inferred: point.inferred,
    grammar: grammarOf(point),
    passageId: passageIdOf(point),
    lineIds: legacy ? (seeded.get(point.id) ?? []) : lineIds,
    userEdited: point.userEditedAt !== null,
  }));
  const plan = planNoteEdit({
    lines,
    newText: upload.pendingText,
    points,
    passages: passageRows.map((passage) => ({
      id: passage.id,
      lineIds: legacy ? (seeded.get(passage.id) ?? []) : passage.lineIds,
    })),
    newId: () => crypto.randomUUID(),
  });

  const reviewed = new Set([...plan.points.map((entry) => entry.point.id), ...plan.retirePointIds]);
  const keptKeys = points
    .filter((point) => !reviewed.has(point.id))
    .map((point) => pointKey(point.category, point.targetText));

  let resolved = null;
  if (plan.window.length > 0) {
    const raw = await deps.extract({
      systemPrompt: REREAD_PROMPT_V1,
      text: JSON.stringify(buildRereadPayload(plan, await languagesFor(db, upload.classroomId))),
      targetHint: null,
    });
    resolved = resolveReread(plan, parseRereadResult(asJson(raw)), keptKeys);
  }

  const write: NoteWrite = {
    uploadId: upload.id,
    classroomId: upload.classroomId,
    promptVersion: REREAD_PROMPT_VERSION,
    lines: plan.lines,
    removedLineIds: legacy ? [] : plan.removedLineIds,
    baseLineIds: legacy ? [] : plan.baseLineIds,
    seedPointLinks,
    seedPassageLinks,
    retirePointIds: [...plan.retirePointIds, ...(resolved?.removePointIds ?? [])],
    retirePassageIds: plan.retirePassageIds,
    updates: resolved?.updates ?? [],
    ...(resolved ? newRows(resolved) : { passages: [], points: [] }),
  };
  return saveReread(db, rereadId, write, {
    discarded: (current) => mergeDiscards(current, resolved?.discarded ?? [], plan),
    subject: normalizeSubject(resolved?.subject ?? null),
    keptEditedPointIds: plan.keptEditedPointIds,
  });
}

// An image has no lines to follow, so reading it again replaces every point the
// learner has not edited. An omit carries over only on an exact one-to-one match.
async function rereadImageNote(db: Db, upload: Upload, rereadId: string, deps: NoteReaderDeps) {
  const [pointRows, passageRows, languages] = await Promise.all([
    listNotePoints(db, upload.id),
    listNotePassages(db, upload.id),
    languagesFor(db, upload.classroomId),
  ]);
  const raw = await deps.extract({
    systemPrompt: EXTRACTION_PROMPT_V3,
    text: null,
    images: await readImage(upload, deps),
    targetHint: languages.target,
  });
  const resolved = resolveLineExtraction([], parseExtractionResult(asJson(raw)));

  const edited = pointRows.filter(({ point }) => point.userEditedAt !== null).map(({ point }) => point);
  const replaced = pointRows.filter(({ point }) => point.userEditedAt === null).map(({ point }) => point);
  const editedKeys = new Set(edited.map((point) => pointKey(point.category, point.targetText)));
  const fresh = {
    ...resolved,
    points: resolved.points.filter((point) => !editedKeys.has(pointKey(point.category, point.targetText))),
  };
  const omitted = carriedOmits(
    replaced.map((point) => ({
      category: point.category,
      targetText: point.targetText,
      omitted: point.retiredAt !== null,
    })),
    fresh.points,
  );

  const write: NoteWrite = {
    uploadId: upload.id,
    classroomId: upload.classroomId,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    lines: [],
    removedLineIds: [],
    baseLineIds: [],
    seedPointLinks: [],
    seedPassageLinks: [],
    retirePointIds: replaced.map((point) => point.id),
    retirePassageIds: passageRows.map((passage) => passage.id),
    updates: [],
    ...newRows(fresh, omitted),
  };
  return saveReread(db, rereadId, write, {
    discarded: () => resolved.discarded,
    subject: normalizeSubject(resolved.subject),
    keptEditedPointIds: [],
  });
}

/** Runs an extract job: a re-read when it names one, else the note's first reading. */
export async function runExtractJob(db: Db, payload: Record<string, unknown>, deps: NoteReaderDeps) {
  const uploadId = payload.uploadId ?? payload.upload_id;
  if (typeof uploadId !== "string" || !uploadId) {
    throw new Error("extract job payload is missing uploadId");
  }
  const rereadId = payload.rereadId;
  if (typeof rereadId === "string" && rereadId) {
    const result = await rereadNote(db, uploadId, rereadId, deps);
    return { kind: "reread" as const, uploadId, result };
  }
  const result = await readNewNote(db, uploadId, deps);
  return { kind: "first" as const, uploadId, result };
}
