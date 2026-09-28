import { EXAM_MIN_POINTS } from "@tmr/core";
import { bankSize, enqueueJob, getActiveComposeJob, getClassroom, hasPaidPlan } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { localDateFor } from "@/app/api/_lib/quiz";

type RouteContext = { params: Promise<{ id: string }> };

// Starts writing an exam. The caller polls the returned compose job, like an on-demand quiz.
export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id } = await context.params;
    const db = getDb();
    const classroom = await getClassroom(db, user.id, id);
    if (!classroom) {
      return jsonError("Not found", 404);
    }
    if (!(await hasPaidPlan(db, user.id))) {
      return jsonError("Exams are a Pro feature", 403, "pro_required");
    }
    if ((await bankSize(db, id)) < EXAM_MIN_POINTS) {
      return jsonError("Add more notes to unlock the exam", 409, "exam_locked");
    }
    const active = await getActiveComposeJob(db, id, "exam");
    if (active) {
      return jsonOk({ status: "pending", jobId: active.id }, 202);
    }
    const job = await enqueueJob(db, {
      kind: "compose",
      payload: {
        classroomId: id,
        userId: user.id,
        localDate: localDateFor(user.timezone),
        source: "exam",
      },
    });
    return jsonOk({ status: "pending", jobId: job?.id ?? null }, 202);
  } catch (error) {
    return handleRouteError(error);
  }
}
