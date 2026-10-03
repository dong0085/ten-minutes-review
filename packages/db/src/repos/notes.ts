import { and, asc, count, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import type { ExtractionDiscard, GrammarDetail, KnowledgePointDetail, NoteRereadResult } from "@tmr/core";
import type { Db } from "../client";
import { classrooms, uploads } from "../schema/classrooms";
import {
  knowledgePointLines,
  knowledgePoints,
  noteLines,
  passageLines,
  passages,
} from "../schema/bank";
import { jobs } from "../schema/jobs";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type NoteLinkRow = { ownerId: string; lineIds: string[] };

/** The note's lines, in order. */
export async function listNoteLines(db: Db | Tx, uploadId: string) {
  return db
    .select({ id: noteLines.id, text: noteLines.text })
    .from(noteLines)
    .where(eq(noteLines.uploadId, uploadId))
    .orderBy(asc(noteLines.position));
}

/** Live (not replaced) points from one note in line order, each with the lines it came from. */
export async function listNotePoints(db: Db, uploadId: string) {
  return db
    .select({
      point: knowledgePoints,
      lineIds: sql<string[]>`coalesce(array_agg(${knowledgePointLines.noteLineId}) filter (where ${knowledgePointLines.noteLineId} is not null), '{}')`,
    })
    .from(knowledgePoints)
    .leftJoin(knowledgePointLines, eq(knowledgePointLines.knowledgePointId, knowledgePoints.id))
    .leftJoin(noteLines, eq(noteLines.id, knowledgePointLines.noteLineId))
    .where(and(eq(knowledgePoints.sourceUploadId, uploadId), isNull(knowledgePoints.supersededAt)))
    .groupBy(knowledgePoints.id)
    .orderBy(
      sql`min(${noteLines.position}) asc nulls last`,
      asc(knowledgePoints.createdAt),
      asc(knowledgePoints.id),
    );
}

/** Live passages from one note, each with the lines it came from. */
export async function listNotePassages(db: Db, uploadId: string) {
  return db
    .select({
      id: passages.id,
      sourceExcerpt: passages.sourceExcerpt,
      lineIds: sql<string[]>`coalesce(array_agg(${passageLines.noteLineId}) filter (where ${passageLines.noteLineId} is not null), '{}')`,
    })
    .from(passages)
    .leftJoin(passageLines, eq(passageLines.passageId, passages.id))
    .where(and(eq(passages.sourceUploadId, uploadId), isNull(passages.supersededAt)))
    .groupBy(passages.id);
}

export type RereadStart =
  | { ok: true; rereadId: string }
  | { ok: false; reason: "not_found" | "busy" | "not_ready" };

/**
 * Claims the note for one re-read. The conditional update is the lock: it only
 * succeeds while no other re-read is waiting or running, so two quick saves
 * cannot both start one. A failed re-read is replaced.
 */
export async function startNoteReread(
  db: Db,
  uploadId: string,
  pendingText: string | null,
): Promise<RereadStart> {
  const rereadId = crypto.randomUUID();
  const [claimed] = await db
    .update(uploads)
    .set({
      rereadId,
      rereadStatus: "pending",
      pendingText,
      rereadError: null,
    })
    .where(
      and(
        eq(uploads.id, uploadId),
        eq(uploads.extractionStatus, "done"),
        or(isNull(uploads.rereadStatus), eq(uploads.rereadStatus, "failed")),
      ),
    )
    .returning({ id: uploads.id });
  if (claimed) {
    return { ok: true, rereadId };
  }
  const [upload] = await db
    .select({ status: uploads.extractionStatus })
    .from(uploads)
    .where(eq(uploads.id, uploadId))
    .limit(1);
  if (!upload) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: false, reason: upload.status === "done" ? "busy" : "not_ready" };
}

/** Drops a failed re-read, so the note shows its current text with no error. */
export async function discardFailedReread(db: Db, uploadId: string) {
  const [row] = await db
    .update(uploads)
    .set({ rereadId: null, rereadStatus: null, pendingText: null, rereadError: null })
    .where(and(eq(uploads.id, uploadId), eq(uploads.rereadStatus, "failed")))
    .returning({ id: uploads.id });
  return Boolean(row);
}

/** Moves a re-read to running; false when the request is stale or was discarded. */
export async function markRereadRunning(db: Db, uploadId: string, rereadId: string) {
  const [row] = await db
    .update(uploads)
    .set({ rereadStatus: "running", rereadError: null })
    .where(
      and(
        eq(uploads.id, uploadId),
        eq(uploads.rereadId, rereadId),
        inArray(uploads.rereadStatus, ["pending", "running", "failed"]),
      ),
    )
    .returning({ id: uploads.id });
  return Boolean(row);
}

export async function failReread(db: Db, uploadId: string, rereadId: string, error: string) {
  await db
    .update(uploads)
    .set({ rereadStatus: "failed", rereadError: error.slice(0, 2000) })
    .where(and(eq(uploads.id, uploadId), eq(uploads.rereadId, rereadId)));
}

/** Puts a failed first reading back in the queue, optionally with corrected text. */
export async function retryFailedExtraction(db: Db, uploadId: string, textContent?: string) {
  const [row] = await db
    .update(uploads)
    .set({
      extractionStatus: "pending",
      extractionError: null,
      ...(textContent !== undefined ? { textContent } : {}),
    })
    .where(and(eq(uploads.id, uploadId), eq(uploads.extractionStatus, "failed")))
    .returning({ id: uploads.id });
  return Boolean(row);
}

/** Re-reads the user started since a time, for the shared daily safety limit. */
export async function countRereadsSince(db: Db, userId: string, since: Date) {
  const [row] = await db
    .select({ value: count() })
    .from(jobs)
    .innerJoin(uploads, sql`${uploads.id}::text = ${jobs.payload}->>'uploadId'`)
    .innerJoin(classrooms, eq(uploads.classroomId, classrooms.id))
    .where(
      and(
        eq(jobs.kind, "extract"),
        sql`${jobs.payload} ? 'rereadId'`,
        gte(jobs.createdAt, since),
        eq(classrooms.userId, userId),
      ),
    );
  return Number(row?.value ?? 0);
}

// ----- Writing a reading -----------------------------------------------------

export type NewNotePassage = {
  /** Set by the caller so lines can link to it before it is saved. */
  id: string;
  targetText: string;
  nativeText: string | null;
  sourceExcerpt: string | null;
  lineIds: string[];
};

export type NewNotePoint = {
  category: (typeof knowledgePoints.$inferInsert)["category"];
  targetText: string;
  nativeText: string | null;
  inferred: boolean;
  note: string | null;
  detail: KnowledgePointDetail;
  sourceExcerpt: string | null;
  lineIds: string[];
  omitted: boolean;
};

export type NotePointUpdate = {
  pointId: string;
  targetText: string;
  nativeText: string | null;
  inferred: boolean;
  note: string | null;
  grammar: GrammarDetail | null;
  sourceExcerpt: string | null;
  lineIds: string[] | null;
};

export type NoteWrite = {
  uploadId: string;
  classroomId: string;
  promptVersion: string;
  /** The note's lines after the reading, in order; upserted by id. */
  lines: { id: string; text: string }[];
  removedLineIds: string[];
  /** Line ids the note must still have, else another change got there first. */
  baseLineIds: string[];
  /** Links for points saved before lines existed, matched by excerpt. */
  seedPointLinks: NoteLinkRow[];
  seedPassageLinks: NoteLinkRow[];
  retirePointIds: string[];
  retirePassageIds: string[];
  updates: NotePointUpdate[];
  passages: NewNotePassage[];
  points: NewNotePoint[];
};

function linkRows<T extends string>(owners: NoteLinkRow[], key: T, liveLines: Set<string>) {
  return owners.flatMap((owner) =>
    owner.lineIds
      .filter((lineId) => liveLines.has(lineId))
      .map((noteLineId) => ({ [key]: owner.ownerId, noteLineId }) as Record<T, string> & { noteLineId: string }),
  );
}

// Every write to a note's lines and points goes through here, inside the caller's
// transaction, so a reading lands whole or not at all.
async function writeNote(tx: Tx, write: NoteWrite, now: Date) {
  const current = await tx
    .select({ id: noteLines.id })
    .from(noteLines)
    .where(eq(noteLines.uploadId, write.uploadId));
  const currentIds = new Set(current.map((row) => row.id));
  if (
    currentIds.size !== write.baseLineIds.length ||
    write.baseLineIds.some((id) => !currentIds.has(id))
  ) {
    throw new Error(`note ${write.uploadId} changed while it was being read`);
  }

  if (write.removedLineIds.length > 0) {
    await tx.delete(noteLines).where(inArray(noteLines.id, write.removedLineIds));
  }
  if (write.lines.length > 0) {
    await tx
      .insert(noteLines)
      .values(
        write.lines.map((line, position) => ({
          id: line.id,
          uploadId: write.uploadId,
          position,
          text: line.text,
        })),
      )
      .onConflictDoUpdate({
        target: noteLines.id,
        set: { position: sql`excluded.position`, text: sql`excluded.text` },
      });
  }
  const liveLines = new Set(write.lines.map((line) => line.id));

  const seededPoints = linkRows(write.seedPointLinks, "knowledgePointId", liveLines);
  if (seededPoints.length > 0) {
    await tx.insert(knowledgePointLines).values(seededPoints).onConflictDoNothing();
  }
  const seededPassages = linkRows(write.seedPassageLinks, "passageId", liveLines);
  if (seededPassages.length > 0) {
    await tx.insert(passageLines).values(seededPassages).onConflictDoNothing();
  }

  // A point the learner edited by hand, or one already replaced, is never touched.
  const replaceable = and(isNull(knowledgePoints.userEditedAt), isNull(knowledgePoints.supersededAt));
  let removed = 0;
  if (write.retirePointIds.length > 0) {
    const rows = await tx
      .update(knowledgePoints)
      .set({ supersededAt: now, retiredAt: sql`coalesce(${knowledgePoints.retiredAt}, ${now.toISOString()}::timestamptz)` })
      .where(and(inArray(knowledgePoints.id, write.retirePointIds), replaceable))
      .returning({ id: knowledgePoints.id });
    removed = rows.length;
  }
  if (write.retirePassageIds.length > 0) {
    await tx
      .update(passages)
      .set({ supersededAt: now })
      .where(and(inArray(passages.id, write.retirePassageIds), isNull(passages.supersededAt)));
  }

  let updated = 0;
  for (const update of write.updates) {
    const [row] = await tx
      .update(knowledgePoints)
      .set({
        targetText: update.targetText,
        nativeText: update.nativeText,
        inferred: update.inferred,
        note: update.note,
        ...(update.grammar ? { detail: { grammar: update.grammar } } : {}),
        ...(update.sourceExcerpt ? { sourceExcerpt: update.sourceExcerpt } : {}),
        promptVersion: write.promptVersion,
      })
      .where(and(eq(knowledgePoints.id, update.pointId), replaceable))
      .returning({ id: knowledgePoints.id });
    if (!row) {
      continue;
    }
    updated += 1;
    if (update.lineIds) {
      await tx.delete(knowledgePointLines).where(eq(knowledgePointLines.knowledgePointId, update.pointId));
      const links = update.lineIds
        .filter((lineId) => liveLines.has(lineId))
        .map((noteLineId) => ({ knowledgePointId: update.pointId, noteLineId }));
      if (links.length > 0) {
        await tx.insert(knowledgePointLines).values(links);
      }
    }
  }

  if (write.passages.length > 0) {
    await tx.insert(passages).values(
      write.passages.map((passage) => ({
        id: passage.id,
        classroomId: write.classroomId,
        sourceUploadId: write.uploadId,
        targetText: passage.targetText,
        nativeText: passage.nativeText,
        sourceExcerpt: passage.sourceExcerpt,
      })),
    );
    const links = linkRows(
      write.passages.map((passage) => ({ ownerId: passage.id, lineIds: passage.lineIds })),
      "passageId",
      liveLines,
    );
    if (links.length > 0) {
      await tx.insert(passageLines).values(links);
    }
  }

  if (write.points.length > 0) {
    const inserted = await tx
      .insert(knowledgePoints)
      .values(
        write.points.map((point) => ({
          classroomId: write.classroomId,
          sourceUploadId: write.uploadId,
          category: point.category,
          targetText: point.targetText,
          nativeText: point.nativeText,
          inferred: point.inferred,
          note: point.note,
          detail: point.detail,
          sourceExcerpt: point.sourceExcerpt,
          promptVersion: write.promptVersion,
          retiredAt: point.omitted ? now : null,
        })),
      )
      .returning({ id: knowledgePoints.id });
    const links = linkRows(
      inserted.map((row, index) => ({ ownerId: row.id, lineIds: write.points[index]?.lineIds ?? [] })),
      "knowledgePointId",
      liveLines,
    );
    if (links.length > 0) {
      await tx.insert(knowledgePointLines).values(links);
    }
  }

  return { updated, removed, added: write.points.length };
}

/**
 * Saves a note's first reading in one transaction. Returns false when the note
 * was already read, so a retried job adds nothing twice.
 */
export async function saveFirstReading(
  db: Db,
  write: NoteWrite,
  outcome: { discarded: ExtractionDiscard[]; subject: string | null },
) {
  return db.transaction(async (tx) => {
    const [upload] = await tx
      .select({ status: uploads.extractionStatus })
      .from(uploads)
      .where(eq(uploads.id, write.uploadId))
      .for("update");
    if (!upload || upload.status === "done") {
      return false;
    }
    const now = new Date();
    await writeNote(tx, write, now);
    await tx
      .update(uploads)
      .set({
        extractionStatus: "done",
        extractedAt: now,
        extractionError: null,
        discarded: outcome.discarded,
        subject: outcome.subject,
      })
      .where(eq(uploads.id, write.uploadId));
    return true;
  });
}

/**
 * Saves a re-read in one transaction, only while it is still the note's current
 * re-read. Returns what changed, or null when the request went stale.
 */
export async function saveReread(
  db: Db,
  rereadId: string,
  write: NoteWrite,
  outcome: {
    discarded: (current: ExtractionDiscard[]) => ExtractionDiscard[];
    subject: string | null;
    keptEditedPointIds: string[];
  },
): Promise<NoteRereadResult | null> {
  return db.transaction(async (tx) => {
    const [upload] = await tx
      .select()
      .from(uploads)
      .where(eq(uploads.id, write.uploadId))
      .for("update");
    if (!upload || upload.rereadId !== rereadId || upload.rereadStatus !== "running") {
      return null;
    }
    const now = new Date();
    const counts = await writeNote(tx, write, now);
    const result: NoteRereadResult = {
      ...counts,
      keptEditedPointIds: outcome.keptEditedPointIds,
    };
    await tx
      .update(uploads)
      .set({
        ...(upload.pendingText !== null ? { textContent: upload.pendingText, editedAt: now } : {}),
        discarded: outcome.discarded(upload.discarded),
        ...(outcome.subject ? { subject: outcome.subject } : {}),
        rereadId: null,
        rereadStatus: null,
        pendingText: null,
        rereadError: null,
        rereadResult: result,
        rereadCount: sql`${uploads.rereadCount} + 1`,
      })
      .where(eq(uploads.id, write.uploadId));
    return result;
  });
}
