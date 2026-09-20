import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { gradeAttempt } from "@tmr/core";
import type { QuestionResponse } from "@tmr/core";
import {
  attempts,
  createAttemptWithAnswers,
  getQuizWithQuestionsForUser,
  knowledgePoints,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/session";
import { verifyAttemptToken } from "@/lib/tokens";

const submitSchema = z.object({
  attemptToken: z.string().min(1),
  responses: z
    .array(
      z.object({
        questionId: z.string().min(1),
        response: z.unknown(),
        durationMs: z.number().int().nonnegative().optional(),
      }),
    )
    .default([]),
  durationMs: z.number().int().nonnegative(),
});

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const body = await readJson(request, submitSchema);
    const token = verifyAttemptToken(body.attemptToken, env.authSecret);
    if (!token) {
      return jsonError("Attempt token is invalid or expired", 400, "attempt_invalid");
    }

    const db = getDb();
    const row = await getQuizWithQuestionsForUser(db, user.id, token.quizId);
    if (!row) {
      return jsonError("Not found", 404);
    }

    const startedAt = new Date(token.startedAt);
    const reused = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(
        and(
          eq(attempts.quizId, token.quizId),
          eq(attempts.userId, user.id),
          eq(attempts.startedAt, startedAt),
        ),
      )
      .limit(1);
    if (reused.length > 0) {
      return jsonError("This attempt was already submitted", 400);
    }

    const responsesById = new Map(body.responses.map((entry) => [entry.questionId, entry]));
    const graded = gradeAttempt(
      row.questions.map((question) => ({
        id: question.id,
        type: question.type,
        answer: question.answer,
      })),
      new Map(body.responses.map((entry) => [entry.questionId, entry.response])),
    );
    const isCorrectById = new Map(
      graded.results.map((result) => [result.questionId, result.isCorrect]),
    );

    const attempt = await createAttemptWithAnswers(db, {
      quizId: row.quiz.id,
      userId: user.id,
      startedAt,
      durationMs: body.durationMs,
      correctCount: graded.correctCount,
      questionCount: graded.questionCount,
      answers: row.questions.map((question) => ({
        questionId: question.id,
        response: (responsesById.get(question.id)?.response ?? {}) as QuestionResponse,
        isCorrect: isCorrectById.get(question.id) ?? false,
        durationMs: responsesById.get(question.id)?.durationMs ?? null,
      })),
    });
    if (!attempt) {
      return jsonError("Could not record the attempt", 500);
    }

    const pointIds = Array.from(new Set(row.questions.map((q) => q.knowledgePointId)));
    const pointRows =
      pointIds.length > 0
        ? await db
            .select({
              id: knowledgePoints.id,
              retiredAt: knowledgePoints.retiredAt,
            })
            .from(knowledgePoints)
            .where(inArray(knowledgePoints.id, pointIds))
        : [];
    const retiredPointIds = new Set(
      pointRows.filter((p) => p.retiredAt !== null).map((p) => p.id),
    );

    return jsonOk({
      attemptId: attempt.id,
      correctCount: graded.correctCount,
      questionCount: graded.questionCount,
      results: row.questions.map((question) => ({
        questionId: question.id,
        knowledgePointId: question.knowledgePointId,
        isKnowledgePointRetired: retiredPointIds.has(question.knowledgePointId),
        isCorrect: isCorrectById.get(question.id) ?? false,
        correctAnswer: question.answer,
        explanation: question.explanation,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
