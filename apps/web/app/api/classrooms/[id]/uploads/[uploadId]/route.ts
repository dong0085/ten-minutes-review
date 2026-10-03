import { z } from "zod";
import { joinNoteLines, splitNoteLines } from "@tmr/core";
import { listNotePoints } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { findNote, requestNoteReading, rereadsLeft } from "@/lib/note-reread";
import { getCurrentUserOrGuest } from "@/lib/session";
import { toUploadJson } from "@/lib/uploads";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string; uploadId: string }> };

const editSchema = z.object({
  text: z.string().trim().min(1),
});

/** One note in full, with the points it gave and any re-read in progress. */
export async function GET(_request: Request, context: RouteContext) {
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
    const [json, pointRows, left] = await Promise.all([
      toUploadJson(upload),
      listNotePoints(db, upload.id),
      rereadsLeft(db, user, upload),
    ]);
    return jsonOk({
      upload: json,
      points: pointRows.map(({ point }) => ({
        id: point.id,
        category: point.category,
        targetText: point.targetText,
        nativeText: point.nativeText,
        isRetired: point.retiredAt !== null,
        userEdited: point.userEditedAt !== null,
      })),
      rereadsLeft: left,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Saves edited text and reads the changed lines again. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id, uploadId } = await context.params;
    const body = await readJson(request, editSchema);
    const db = getDb();
    const upload = await findNote(db, user.id, id, uploadId);
    if (!upload) {
      return jsonError("Not found", 404);
    }
    if (upload.kind !== "text") {
      return jsonError("Only typed notes can be edited", 400);
    }
    const text = joinNoteLines(splitNoteLines(body.text));
    if (text === upload.textContent) {
      return jsonError("No changes to save", 400);
    }
    return requestNoteReading(db, user, upload, text);
  } catch (error) {
    return handleRouteError(error);
  }
}
