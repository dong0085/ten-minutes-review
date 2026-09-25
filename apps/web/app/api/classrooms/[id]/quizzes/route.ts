import {
  bankSize,
  enqueueJob,
  getActiveComposeJob,
  getClassroom,
  listQuizzesForClassroom,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";
import { localDateFor } from "@/app/api/_lib/quiz";

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
    const quizzes = await listQuizzesForClassroom(db, user.id, id);
    return jsonOk({ quizzes });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(_request: Request, context: RouteContext) {
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
    if ((await bankSize(db, id)) === 0) {
      return jsonError("Add notes to create a quiz", 409, "empty_bank");
    }
    // The caller polls this job to learn which quiz it produced.
    const active = await getActiveComposeJob(db, id);
    if (active) {
      return jsonOk({ status: "pending", jobId: active.id }, 202);
    }
    const job = await enqueueJob(db, {
      kind: "compose",
      payload: {
        classroomId: id,
        userId: user.id,
        localDate: localDateFor(user.timezone),
        source: "manual",
        sendEmail: false,
      },
    });
    return jsonOk({ status: "pending", jobId: job?.id ?? null }, 202);
  } catch (error) {
    return handleRouteError(error);
  }
}
