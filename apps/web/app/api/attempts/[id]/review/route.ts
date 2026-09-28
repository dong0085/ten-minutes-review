import {
  enqueueJob,
  getAttemptForUser,
  getLatestSummarizeJob,
  getQuizWithQuestionsForUser,
  hasPaidPlan,
} from "@tmr/db";
import type { Db } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

// The AI review of an exam attempt: ready once the worker saved it, writing while its job runs.
async function reviewState(db: Db, attempt: { id: string; review: unknown }) {
  if (attempt.review) {
    return { status: "ready" as const, review: attempt.review };
  }
  const job = await getLatestSummarizeJob(db, attempt.id);
  const status =
    !job || job.status === "cancelled"
      ? ("none" as const)
      : job.status === "failed"
        ? ("failed" as const)
        : job.status === "done"
          ? ("none" as const)
          : ("writing" as const);
  return { status, review: null };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id } = await context.params;
    const db = getDb();
    const attempt = await getAttemptForUser(db, user.id, id);
    if (!attempt) {
      return jsonError("Not found", 404);
    }
    return jsonOk(await reviewState(db, attempt));
  } catch (error) {
    return handleRouteError(error);
  }
}

// Asks the worker to write the review again, after a failed run.
export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id } = await context.params;
    const db = getDb();
    const attempt = await getAttemptForUser(db, user.id, id);
    if (!attempt) {
      return jsonError("Not found", 404);
    }
    const state = await reviewState(db, attempt);
    if (state.status === "ready" || state.status === "writing") {
      return jsonOk(state);
    }
    const quiz = await getQuizWithQuestionsForUser(db, user.id, attempt.quizId);
    if (!quiz || quiz.quiz.kind !== "exam" || attempt.correctCount >= attempt.questionCount) {
      return jsonError("Not found", 404);
    }
    if (!(await hasPaidPlan(db, user.id))) {
      return jsonError("Exams are a Pro feature", 403, "pro_required");
    }
    await enqueueJob(db, { kind: "summarize", payload: { attemptId: attempt.id } });
    return jsonOk({ status: "writing", review: null }, 202);
  } catch (error) {
    return handleRouteError(error);
  }
}
