import type { Category } from "@tmr/core";
import {
  countBankByCategory,
  getClassroom,
  getDailyQuizByClassroomAndDate,
  getLatestComposeJob,
  listQuizzesForClassroom,
  listUntakenOnDemandQuizzes,
  listUploadsForUser,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";
import { localDateFor } from "@/app/api/_lib/quiz";

type RouteContext = { params: Promise<{ id: string }> };

const REHYDRATE_WINDOW_MS = 10 * 60 * 1000;

// Everything the classroom hub shows in one round trip: today's quiz state,
// a compose job still in flight, and the counts behind each drill-down row.
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
    const today = localDateFor(user.timezone);
    const [categoryRows, dailyQuiz, uploads, quizzes, unfinished, composeJob] = await Promise.all([
      countBankByCategory(db, user.id, id),
      getDailyQuizByClassroomAndDate(db, id, today),
      listUploadsForUser(db, user.id, id),
      listQuizzesForClassroom(db, user.id, id),
      listUntakenOnDemandQuizzes(db, id, 3),
      getLatestComposeJob(db, id, REHYDRATE_WINDOW_MS),
    ]);
    const bankByCategory: Record<Category, number> = {
      vocabulary: 0,
      phrase: 0,
      grammar: 0,
      expression: 0,
      comprehension: 0,
    };
    for (const row of categoryRows) {
      bankByCategory[row.category] = row.value;
    }
    const pendingUploads = uploads.filter(
      ({ upload }) => upload.extractionStatus === "pending" || upload.extractionStatus === "running",
    ).length;
    return jsonOk({
      today,
      dailyQuizId: dailyQuiz?.id ?? null,
      composeJob: composeJob
        ? { id: composeJob.id, status: composeJob.status, requestedAt: composeJob.createdAt }
        : null,
      counts: {
        uploads: uploads.length,
        pendingUploads,
        bank: Object.values(bankByCategory).reduce((sum, value) => sum + value, 0),
        quizzes: quizzes.length,
      },
      bankByCategory,
      lastUploadAt: uploads[0]?.upload.createdAt ?? null,
      unfinished,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
