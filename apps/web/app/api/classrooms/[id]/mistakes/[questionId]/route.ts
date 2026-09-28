import { z } from "zod";
import { gradeAnswer } from "@tmr/core";
import type { QuestionResponse } from "@tmr/core";
import { getClassroomQuestion, hasPaidPlan, isOpenMistake, recordMistakePractice } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string; questionId: string }> };

const answerSchema = z.object({ response: z.unknown() });

// Grades one mistake-book answer. A right answer clears the question from the book.
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id, questionId } = await context.params;
    const body = await readJson(request, answerSchema);
    const db = getDb();
    if (!(await hasPaidPlan(db, user.id))) {
      return jsonError("Corrections are a Pro feature", 403, "pro_required");
    }
    if (!(await isOpenMistake(db, user.id, id, questionId))) {
      return jsonError("Not found", 404);
    }
    const question = await getClassroomQuestion(db, user.id, id, questionId);
    if (!question) {
      return jsonError("Not found", 404);
    }
    const isCorrect = gradeAnswer(question.type, question.answer, body.response);
    await recordMistakePractice(db, {
      userId: user.id,
      classroomId: id,
      questionId,
      response: (body.response ?? {}) as QuestionResponse,
      isCorrect,
    });
    return jsonOk({
      isCorrect,
      correctAnswer: question.answer,
      explanation: question.explanation,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
