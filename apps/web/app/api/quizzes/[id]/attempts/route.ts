import { getQuizForUser } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { ATTEMPT_TTL_MS } from "@tmr/core";
import { getSessionUser } from "@/lib/session";
import { createAttemptToken } from "@/lib/tokens";
import { buildQuizPayload } from "@/app/api/_lib/quiz";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id } = await context.params;
    const quiz = await getQuizForUser(getDb(), user.id, id);
    if (!quiz) {
      return jsonError("Not found", 404);
    }
    const payload = await buildQuizPayload(user.id, quiz.id);
    if (!payload) {
      return jsonError("Not found", 404);
    }
    const attemptToken = createAttemptToken(
      {
        quizId: quiz.id,
        startedAt: Date.now(),
        expiresAt: Date.now() + ATTEMPT_TTL_MS,
      },
      env.authSecret,
    );
    return jsonOk({ attemptToken, questions: payload.questions });
  } catch (error) {
    return handleRouteError(error);
  }
}
