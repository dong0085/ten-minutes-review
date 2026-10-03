import {
  COMPOSE_REHYDRATE_MS,
  EXAM_MIN_POINTS,
  HUB_RECENT_QUIZ_LIMIT,
  type Category,
} from "@tmr/core";
import {
  countBankByCategory,
  countOpenMistakes,
  getClassroom,
  getDailyQuizByClassroomAndDate,
  getLatestComposeJob,
  listAttemptsForQuiz,
  listQuizzesForClassroom,
  listUploadsForUser,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";
import { localDateFor } from "@/app/api/_lib/quiz";

type RouteContext = { params: Promise<{ id: string }> };

// Everything the classroom hub shows in one round trip: today's daily quiz and
// how it went, the latest quizzes and exams, a compose job still in flight,
// and the counts behind each drill-down row.
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
    const [
      categoryRows,
      dailyQuiz,
      uploads,
      quizzes,
      composeJob,
      examJob,
      mistakes,
    ] = await Promise.all([
      countBankByCategory(db, user.id, id),
      getDailyQuizByClassroomAndDate(db, id, today),
      listUploadsForUser(db, user.id, id),
      listQuizzesForClassroom(db, user.id, id),
      getLatestComposeJob(db, id, COMPOSE_REHYDRATE_MS),
      getLatestComposeJob(db, id, COMPOSE_REHYDRATE_MS, "exam"),
      countOpenMistakes(db, user.id, id),
    ]);
    const latestExam = quizzes.find((quiz) => quiz.kind === "exam");
    // Today's daily quiz counts as done once it has any attempt; the hub
    // links to the latest one.
    const dailyTaken = quizzes.some(
      (quiz) => quiz.id === dailyQuiz?.id && quiz.attemptCount > 0,
    );
    const [dailyAttempt] =
      dailyQuiz && dailyTaken
        ? await listAttemptsForQuiz(db, user.id, dailyQuiz.id)
        : [];
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
      dailyReview: dailyAttempt
        ? {
            attemptId: dailyAttempt.id,
            quizId: dailyAttempt.quizId,
            correctCount: dailyAttempt.correctCount,
            questionCount: dailyAttempt.questionCount,
          }
        : null,
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
      recentQuizzes: quizzes.slice(0, HUB_RECENT_QUIZ_LIMIT),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
