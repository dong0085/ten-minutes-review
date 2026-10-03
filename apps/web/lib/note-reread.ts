import { after } from "next/server";
import { FREE_NOTE_REREADS } from "@tmr/core";
import {
  countRereadsSince,
  countUploadsSince,
  enqueueJob,
  getEffectiveLimits,
  getUploadForUser,
  hasPaidPlan,
  retryFailedExtraction,
  startNoteReread,
} from "@tmr/db";
import type { Db, Upload } from "@tmr/db";
import { jsonError, jsonOk } from "./api";
import { processExtractJob } from "./extract";

type ReadingUser = { id: string; isGuest: boolean };

/** The note, if it belongs to this user and classroom. */
export async function findNote(db: Db, userId: string, classroomId: string, uploadId: string) {
  const row = await getUploadForUser(db, userId, uploadId);
  return row && row.upload.classroomId === classroomId ? row.upload : null;
}

/** Edits or re-reads left on this note: null when the plan has no per-note cap. */
export async function rereadsLeft(db: Db, user: ReadingUser, upload: Upload) {
  const paid = !user.isGuest && (await hasPaidPlan(db, user.id));
  return paid ? null : Math.max(0, FREE_NOTE_REREADS - upload.rereadCount);
}

function schedule(jobId: string, userId: string) {
  after(() => processExtractJob(jobId, userId));
}

/**
 * Starts reading a note again, with edited text or as it stands. A note whose
 * first reading failed is simply read again (with the corrected text, if any)
 * and costs nothing. Otherwise the per-note cap and the daily limit apply, and
 * only one re-read per note runs at a time.
 */
export async function requestNoteReading(
  db: Db,
  user: ReadingUser,
  upload: Upload,
  pendingText: string | null,
) {
  if (upload.extractionStatus === "failed") {
    await retryFailedExtraction(db, upload.id, pendingText ?? undefined);
    const job = await enqueueJob(db, { kind: "extract", payload: { uploadId: upload.id } });
    schedule(job.id, user.id);
    return jsonOk({ uploadId: upload.id }, 202);
  }
  if (upload.extractionStatus !== "done") {
    return jsonError("These notes have not been read yet", 409);
  }
  if (upload.rereadStatus === "pending" || upload.rereadStatus === "running") {
    return jsonError("These notes are already being read", 409);
  }

  const left = await rereadsLeft(db, user, upload);
  if (left === 0) {
    return jsonError(`Free plan allows ${FREE_NOTE_REREADS} re-reads per note`, 403, "pro_required");
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const limits = await getEffectiveLimits(db, user.id);
  const [uploadsToday, rereadsToday] = await Promise.all([
    countUploadsSince(db, user.id, since),
    countRereadsSince(db, user.id, since),
  ]);
  if (uploadsToday + rereadsToday >= limits.uploadsPerDay) {
    return jsonError(`Upload limit reached: ${limits.uploadsPerDay} uploads per day`, 429);
  }

  const started = await startNoteReread(db, upload.id, pendingText);
  if (!started.ok) {
    return started.reason === "not_found"
      ? jsonError("Not found", 404)
      : jsonError("These notes are already being read", 409);
  }
  const job = await enqueueJob(db, {
    kind: "extract",
    payload: { uploadId: upload.id, rereadId: started.rereadId },
  });
  schedule(job.id, user.id);
  return jsonOk({ uploadId: upload.id, rereadId: started.rereadId }, 202);
}
