import { FREE_TIER, hasPaidAccess, startOfMonthAt } from "@tmr/core";
import {
  countClassrooms,
  countUploadsSince,
  getActivityStats,
  getLearningStats,
  getSubscription,
  listQuizzesForUser,
  listRecentAttemptScores,
  listRecentMissesForUser,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const RECENT_QUIZ_LIMIT = 8;

// The account hub: learning stats, recent quizzes across classrooms, and the
// plan with this month's usage.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const db = getDb();
    const [activity, learning, attempts, misses, quizzes, subscription, classrooms, uploadsThisMonth] =
      await Promise.all([
        getActivityStats(db, user.id, user.timezone),
        getLearningStats(db, user.id),
        listRecentAttemptScores(db, user.id),
        listRecentMissesForUser(db, user.id),
        listQuizzesForUser(db, user.id, RECENT_QUIZ_LIMIT + 1),
        getSubscription(db, user.id),
        countClassrooms(db, user.id),
        countUploadsSince(db, user.id, startOfMonthAt(user.timezone)),
      ]);
    const isPaid = hasPaidAccess(subscription);
    const paymentIssue = subscription?.status === "past_due" || subscription?.status === "unpaid";
    return jsonOk({
      activity,
      learning,
      attempts,
      misses,
      quizzes: quizzes.slice(0, RECENT_QUIZ_LIMIT),
      hasMoreQuizzes: quizzes.length > RECENT_QUIZ_LIMIT,
      quizLimit: RECENT_QUIZ_LIMIT,
      membership: {
        isPaid,
        paymentIssue,
        periodEnd: subscription?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
        billingAction:
          subscription?.stripeCustomerId && (isPaid || paymentIssue) ? "portal" : "checkout",
      },
      usage: {
        classrooms,
        uploadsThisMonth,
        classroomLimit: FREE_TIER.classrooms,
        uploadLimit: FREE_TIER.notesUploadsPerMonth,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
