import type { NextRequest } from "next/server";
import { deleteQuizForUser, listAttemptsForQuiz } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest, getSessionUser } from "@/lib/session";
import { buildQuizPayload } from "@/app/api/_lib/quiz";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Guests take quizzes too, so onboarding can end on a real one.
    const user = (await getCurrentUserOrGuest())?.user;
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id } = await context.params;
    const quiz = await buildQuizPayload(user.id, id);
    if (!quiz) {
      return jsonError("Not found", 404);
    }
    if (request.nextUrl.searchParams.get("includeAttempts") === "1") {
      const rows = await listAttemptsForQuiz(getDb(), user.id, id);
      const attempts = rows.map((attempt) => ({
        id: attempt.id,
        submittedAt: attempt.submittedAt,
        correctCount: attempt.correctCount,
        questionCount: attempt.questionCount,
        durationMs: attempt.durationMs,
      }));
      return jsonOk({ quiz, attempts });
    }
    return jsonOk({ quiz });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id } = await context.params;
    const deleted = await deleteQuizForUser(getDb(), user.id, id);
    if (!deleted) {
      return jsonError("Not found", 404);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
