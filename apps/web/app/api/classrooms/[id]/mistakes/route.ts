import { MISTAKE_WINDOW_DAYS } from "@tmr/core";
import {
  getClassroom,
  hasPaidPlan,
  listOpenMistakes,
  listTutorRequestsForClassroom,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { tutorPayload } from "@/app/api/_lib/tutor";

type RouteContext = { params: Promise<{ id: string }> };

// The classroom's mistake book: questions missed in the window and not yet put right.
// Answers stay withheld until each one is answered here.
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
    if (!(await hasPaidPlan(db, user.id))) {
      return jsonError("Corrections are a Pro feature", 403, "pro_required");
    }
    const [rows, tutorRequests] = await Promise.all([
      listOpenMistakes(db, user.id, id),
      listTutorRequestsForClassroom(db, user.id, id),
    ]);
    return jsonOk({
      windowDays: MISTAKE_WINDOW_DAYS,
      mistakes: rows.map((row) => ({
        question: {
          id: row.questionId,
          knowledgePointId: row.knowledgePointId,
          category: row.category,
          type: row.type,
          stem: row.stem,
          options: row.options,
        },
        source: { quizId: row.quizId, kind: row.quizKind, quizDate: row.quizDate },
        firstMissedAt: row.firstMissedAt,
        missCount: row.missCount,
        tutor: tutorRequests
          .filter((request) => request.questionId === row.questionId)
          .map(tutorPayload)
          .filter((request) => request.status !== "failed"),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
