import { z } from "zod";
import {
  bankSize,
  deleteClassroom,
  getClassroom,
  setClassroomDailyReviewsPaused,
  updateClassroom,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";

const updateClassroomSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  targetLanguage: z.string().trim().min(2).max(10).optional(),
  nativeLanguage: z.string().trim().min(2).max(10).optional(),
  autoStopDays: z.coerce.number().int().min(1).max(90).optional(),
  includeAnswersInEmail: z.boolean().optional(),
  paused: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id } = await context.params;
    const db = getDb();
    const classroom = await getClassroom(db, user.id, id);
    if (!classroom) {
      return jsonError("Not found", 404);
    }
    return jsonOk({
      classroom: {
        ...classroom,
        isActive: classroom.pausedAt === null && classroom.activeUntil.getTime() > Date.now(),
        bankSize: await bankSize(db, classroom.id),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id } = await context.params;
    const { paused, ...settings } = await readJson(request, updateClassroomSchema);
    const db = getDb();
    let classroom =
      Object.keys(settings).length > 0
        ? await updateClassroom(db, user.id, id, settings)
        : await getClassroom(db, user.id, id);
    if (classroom && paused !== undefined) {
      classroom = await setClassroomDailyReviewsPaused(db, user.id, id, paused);
    }
    if (!classroom) {
      return jsonError("Not found", 404);
    }
    return jsonOk({ classroom });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id } = await context.params;
    const db = getDb();
    const classroom = await getClassroom(db, user.id, id);
    if (!classroom) {
      return jsonError("Not found", 404);
    }
    await deleteClassroom(db, user.id, id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
