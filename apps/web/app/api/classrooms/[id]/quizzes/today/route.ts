import { getClassroom, getDailyQuizByClassroomAndDate, getLatestComposeJob } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { buildQuizPayload, localDateFor } from "@/app/api/_lib/quiz";

type RouteContext = { params: Promise<{ id: string }> };

const REHYDRATE_WINDOW_MS = 10 * 60 * 1000;

export async function GET(_request: Request, context: RouteContext) {
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
    const quizDate = localDateFor(user.timezone);
    const quiz = await getDailyQuizByClassroomAndDate(db, id, quizDate);
    if (!quiz) {
      const job = await getLatestComposeJob(db, id, REHYDRATE_WINDOW_MS);
      return jsonOk({
        quiz: null,
        job: job ? { id: job.id, status: job.status, requestedAt: job.createdAt } : null,
      });
    }
    const payload = await buildQuizPayload(user.id, quiz.id);
    return jsonOk({ quiz: payload, job: null });
  } catch (error) {
    return handleRouteError(error);
  }
}
