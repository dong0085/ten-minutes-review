import { getAttemptReview } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id } = await context.params;
    const review = await getAttemptReview(getDb(), user.id, id);
    if (!review) {
      return jsonError("Not found", 404);
    }
    const { attempt, answers } = review;
    return jsonOk({
      attempt: {
        id: attempt.id,
        quizId: attempt.quizId,
        submittedAt: attempt.submittedAt,
        correctCount: attempt.correctCount,
        questionCount: attempt.questionCount,
        durationMs: attempt.durationMs,
      },
      answers: answers.map((answer) => ({
        questionId: answer.questionId,
        knowledgePointId: answer.knowledgePointId,
        isKnowledgePointRetired: answer.isKnowledgePointRetired,
        position: answer.position,
        category: answer.category,
        type: answer.type,
        stem: answer.stem,
        options: answer.options,
        response: answer.response,
        isCorrect: answer.isCorrect,
        correctAnswer: answer.answer,
        explanation: answer.explanation,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
