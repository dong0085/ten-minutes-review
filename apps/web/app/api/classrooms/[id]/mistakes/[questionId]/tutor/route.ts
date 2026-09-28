import { z } from "zod";
import { TUTOR_MAX_ANALYSES, TUTOR_MAX_HINTS, TUTOR_MODES, gradeAnswer } from "@tmr/core";
import type { QuestionResponse } from "@tmr/core";
import {
  createTutorRequest,
  enqueueJob,
  getClassroomQuestion,
  hasPaidPlan,
  isOpenMistake,
  listTutorRequestsForQuestion,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { tutorPayload } from "@/app/api/_lib/tutor";

type RouteContext = { params: Promise<{ id: string; questionId: string }> };

const tutorSchema = z.object({
  mode: z.enum(TUTOR_MODES),
  response: z.unknown().optional(),
});

// Asks the AI tutor about a Corrections question: the next hint, or an analysis of a wrong answer.
// The worker writes the reply; the page polls /api/tutor/:id.
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id, questionId } = await context.params;
    const body = await readJson(request, tutorSchema);
    const db = getDb();
    if (!(await hasPaidPlan(db, user.id))) {
      return jsonError("Corrections are a Pro feature", 403, "pro_required");
    }
    if (!(await isOpenMistake(db, user.id, id, questionId))) {
      return jsonError("Not found", 404);
    }

    const earlier = (await listTutorRequestsForQuestion(db, user.id, questionId))
      .map(tutorPayload)
      .filter((entry) => entry.mode === body.mode && entry.status !== "failed");
    const pending = earlier.find((entry) => entry.status === "pending");
    if (pending) {
      return jsonOk({ request: pending }, 202);
    }
    if (body.mode === "hint" && earlier.length >= TUTOR_MAX_HINTS) {
      return jsonError("No more hints for this question", 409, "tutor_limit");
    }
    if (body.mode === "analysis") {
      if (earlier.length >= TUTOR_MAX_ANALYSES) {
        return jsonError("No more hints for this question", 409, "tutor_limit");
      }
      // An analysis explains a wrong answer, so it needs one.
      const question = await getClassroomQuestion(db, user.id, id, questionId);
      if (!question || gradeAnswer(question.type, question.answer, body.response)) {
        return jsonError("Invalid form data", 400);
      }
    }

    const created = await createTutorRequest(db, {
      userId: user.id,
      classroomId: id,
      questionId,
      mode: body.mode,
      level: body.mode === "hint" ? earlier.length + 1 : 0,
      response: body.mode === "analysis" ? ((body.response ?? {}) as QuestionResponse) : null,
    });
    if (!created) {
      return jsonError("Could not ask the tutor", 500);
    }
    await enqueueJob(db, { kind: "tutor", payload: { requestId: created.id } });
    return jsonOk({ request: tutorPayload(created) }, 202);
  } catch (error) {
    return handleRouteError(error);
  }
}
