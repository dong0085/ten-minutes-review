import {
  JOB_MAX_ATTEMPTS,
  TUTOR_ANALYSIS_PROMPT_V1,
  TUTOR_HINT_PROMPT_V1,
  TUTOR_PROMPT_VERSION,
  answerGiveaways,
  languageName,
  parseTutorAnalysis,
  parseTutorHint,
  toUiLocale,
} from "@tmr/core";
import { completeTutorRequest, failTutorRequest, getTutorInput } from "@tmr/db";
import type { Db } from "@tmr/db";
import { getLlmProvider } from "../llm";
import type { TutorPayload } from "../llm";
import { describeAnswer, describeResponse, WRITE_IN } from "./answer-text";

type TutorJobPayload = { requestId?: unknown };

/**
 * Writes one tutor reply for a Corrections question. A hint that spells out
 * the answer throws, so the job retries; the last failed try marks the request
 * failed, so the page can offer to ask again.
 */
export async function handleTutorJob(
  db: Db,
  payload: TutorJobPayload,
  attempt = 1,
): Promise<void> {
  const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
  if (!requestId) {
    throw new Error("tutor job is missing requestId");
  }
  const input = await getTutorInput(db, requestId);
  if (!input || input.request.status !== "pending") {
    return;
  }
  const { request, question } = input;

  try {
    const tutorPayload: TutorPayload = {
      mode: request.mode,
      targetLanguage: languageName(input.targetLanguage) ?? input.targetLanguage,
      nativeLanguage: languageName(input.nativeLanguage) ?? input.nativeLanguage,
      writeIn: WRITE_IN[toUiLocale(input.uiLanguage)],
      question: {
        type: question.type,
        category: question.category,
        stem: question.stem,
        options: question.options,
        explanation: question.explanation,
        rightAnswer: describeAnswer(question.type, question.options, question.answer),
      },
      knowledgePoint: { target: input.pointTarget, native: input.pointNative },
      ...(request.mode === "hint"
        ? { level: request.level, earlierHints: input.earlierHints }
        : {
            learnerAnswer: describeResponse(question.type, question.options, request.response),
            missCount: input.missCount,
          }),
    };
    const raw = await getLlmProvider().tutor({
      systemPrompt: request.mode === "hint" ? TUTOR_HINT_PROMPT_V1 : TUTOR_ANALYSIS_PROMPT_V1,
      payload: tutorPayload,
    });
    const content =
      request.mode === "hint"
        ? parseTutorHint(raw, answerGiveaways(question.type, question.options, question.answer))
        : parseTutorAnalysis(raw);
    await completeTutorRequest(db, request.id, content, TUTOR_PROMPT_VERSION);
  } catch (error) {
    if (attempt >= JOB_MAX_ATTEMPTS) {
      await failTutorRequest(db, request.id);
    }
    throw error;
  }
}
