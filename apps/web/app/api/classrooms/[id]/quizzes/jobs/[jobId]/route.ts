import { getClassroom, getJobById } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string; jobId: string }> };

// Progress of one on-demand compose job. Once it is done, `quizId` names the
// quiz it wrote, so the requester opens that quiz and not today's daily one.
export async function GET(_request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { id, jobId } = await context.params;
    const db = getDb();
    const classroom = await getClassroom(db, current.user.id, id);
    if (!classroom) {
      return jsonError("Not found", 404);
    }
    const job = await getJobById(db, jobId);
    if (!job || job.kind !== "compose" || job.payload?.classroomId !== id) {
      return jsonError("Not found", 404);
    }
    const quizId = typeof job.payload.quizId === "string" ? job.payload.quizId : null;
    return jsonOk({ status: job.status, quizId });
  } catch (error) {
    return handleRouteError(error);
  }
}
