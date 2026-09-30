import {
  COMPOSE_REHYDRATE_MS,
  EXAM_MIN_POINTS,
  RECENT_ON_DEMAND_LIMIT,
  RECENT_ON_DEMAND_MS,
  type Category,
} from "@tmr/core";
import {
  countBankByCategory,
  countOpenMistakes,
  getClassroom,
  getDailyQuizByClassroomAndDate,
  getLatestComposeJob,
  getLatestReviewForClassroomOnDate,
  listQuizzesForClassroom,
  listUntakenOnDemandQuizzes,
  listUploadsForUser,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";
import { localDateFor } from "@/app/api/_lib/quiz";

type RouteContext = { params: Promise<{ id: string }> };

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
    let timezone = "UTC";
    try {
      timezone = new Intl.DateTimeFormat("en", {
        timeZone: user.timezone,
      }).resolvedOptions().timeZone;
    } catch {
      // Match localDateFor's UTC fallback for a legacy invalid timezone.
    }
    const [
      categoryRows,
      dailyQuiz,
      uploads,
      quizzes,
      unfinished,
      composeJob,
      examJob,
      mistakes,
      latestReview,
    ] = await Promise.all([
      countBankByCategory(db, user.id, id),
      getDailyQuizByClassroomAndDate(db, id, today),
      listUploadsForUser(db, user.id, id),
      listQuizzesForClassroom(db, user.id, id),
      listUntakenOnDemandQuizzes(db, id, 3 + RECENT_ON_DEMAND_LIMIT),
      getLatestComposeJob(db, id, COMPOSE_REHYDRATE_MS),
      getLatestComposeJob(db, id, COMPOSE_REHYDRATE_MS, "exam"),
      countOpenMistakes(db, user.id, id),
      getLatestReviewForClassroomOnDate(db, user.id, id, today, timezone),
    ]);
    const latestExam = quizzes.find((quiz) => quiz.kind === "exam");
    // On-demand quizzes from the last day get their own card, taken or not;
    // older untaken ones stay in the Unfinished row.
    const recentSince = Date.now() - RECENT_ON_DEMAND_MS;
    const recentOnDemand = quizzes
      .filter(
        (quiz) =>
          quiz.kind === "manual" && quiz.composedAt.getTime() >= recentSince,
      )
      .slice(0, RECENT_ON_DEMAND_LIMIT);
    const recentIds = new Set(recentOnDemand.map((quiz) => quiz.id));
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
      ({ upload }) =>
        upload.extractionStatus === "pending" ||
        upload.extractionStatus === "running",
    ).length;
    return jsonOk({
      today,
      dailyQuizId: dailyQuiz?.id ?? null,
      latestReview,
      composeJob: composeJob
        ? {
            id: composeJob.id,
            status: composeJob.status,
            requestedAt: composeJob.createdAt,
          }
        : null,
      counts: {
        uploads: uploads.length,
        pendingUploads,
        bank: Object.values(bankByCategory).reduce(
          (sum, value) => sum + value,
          0,
        ),
        quizzes: quizzes.length,
      },
      bankByCategory,
      lastUploadAt: uploads[0]?.upload.createdAt ?? null,
      mistakes,
      exam: {
        requiredPoints: EXAM_MIN_POINTS,
        composeJob: examJob
          ? {
              id: examJob.id,
              status: examJob.status,
              requestedAt: examJob.createdAt,
            }
          : null,
        latest: latestExam
          ? {
              id: latestExam.id,
              quizDate: latestExam.quizDate,
              attemptCount: latestExam.attemptCount,
              bestScore: latestExam.bestScore,
            }
          : null,
      },
      recentOnDemand,
      unfinished: unfinished
        .filter((quiz) => !recentIds.has(quiz.id))
        .slice(0, 3),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
