import { discardFailedReread } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { findNote, requestNoteReading } from "@/lib/note-reread";
import { getCurrentUserOrGuest } from "@/lib/session";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string; uploadId: string }> };

/**
 * Reads the note again as it stands. Also the "Try again" for a failed first
 * reading or a failed re-read: a failed edit is retried with its edited text.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id, uploadId } = await context.params;
    const db = getDb();
    const upload = await findNote(db, user.id, id, uploadId);
    if (!upload) {
      return jsonError("Not found", 404);
    }
    const retryText = upload.rereadStatus === "failed" ? upload.pendingText : null;
    return requestNoteReading(db, user, upload, retryText);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Drops a failed re-read; the note keeps its current text and points. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id, uploadId } = await context.params;
    const db = getDb();
    const upload = await findNote(db, user.id, id, uploadId);
    if (!upload) {
      return jsonError("Not found", 404);
    }
    if (!(await discardFailedReread(db, upload.id))) {
      return jsonError("Nothing to discard", 409);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
