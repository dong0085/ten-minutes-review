import {
  COMPOSITION_PROMPT_V4,
  COMPOSITION_PROMPT_VERSION,
  EXAM_PROMPT_V2,
  EXAM_PROMPT_VERSION,
  fillExamBlueprint,
  selectExamPoints,
  MIN_USABLE_QUESTIONS,
  dailySendAt,
  fitToBudget,
  isClassroomEligibleForDailySend,
  parseCompositionResponse,
  parseCompositionResult,
  quizBudget,
  sanitizeCompositionQuestions,
  selectCompositionPoints,
  shuffleQuizQuestions,
} from "@tmr/core";
import type { KnowledgePointDetail } from "@tmr/core";
import {
  createQuizWithQuestions,
  enqueueJob,
  getClassroom,
  getDailyQuizByClassroomAndDate,
  getJobById,
  hasDeletedDailyQuiz,
  listKnowledgePointsForComposition,
  listLastQuizzedByPoint,
  listRecentMisses,
  listWeekQuestionStems,
  markJobCancelled,
  recordJobResult,
} from "@tmr/db";
import type { Db, NewQuestion } from "@tmr/db";
import { env } from "../env";
import { createJevClient } from "../jev";
import { getLlmProvider } from "../llm";
import { reviewAndRewrite } from "../review";

const DAY_MS = 24 * 60 * 60 * 1000;

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`compose job payload is missing ${key}`);
  }
  return value;
}

function dailyCutoff(payload: Record<string, unknown>): Date {
  if (typeof payload.sendAt === "string") {
    const parsed = new Date(payload.sendAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return dailySendAt();
}

function blocksDailyComposition(
  classroom: { pausedAt: Date | null; createdAt: Date; dailyResumedAt: Date | null },
  sendAt: Date,
): boolean {
  return (
    classroom.pausedAt !== null ||
    !isClassroomEligibleForDailySend(classroom, sendAt)
  );
}

export function passageIdFromDetail(detail: KnowledgePointDetail | null): string | null {
  const value = (detail as { passage_ref?: unknown } | null)?.passage_ref;
  return typeof value === "string" ? value : null;
}

async function cancelIfRequested(db: Db, jobId: string | undefined): Promise<boolean> {
  if (!jobId) {
    return false;
  }
  const job = await getJobById(db, jobId);
  if (!job) {
    return false;
  }
  const cancelRequested = job.payload?.cancelRequested === true;
  if (job.status === "cancelled" || cancelRequested) {
    if (job.status !== "cancelled") {
      await markJobCancelled(db, jobId);
    }
    return true;
  }
  return false;
}

type ComposeClassroom = {
  id: string;
  targetLanguage: string;
  nativeLanguage: string;
  quizLength: number;
};

type BankPoint = Awaited<ReturnType<typeof listKnowledgePointsForComposition>>[number];

/** Picks today's points and builds what the model sees. Shared with the eval snapshot. */
export async function buildDailyCompositionInput(
  db: Db,
  userId: string,
  classroom: ComposeClassroom,
  bank: BankPoint[],
  now = new Date(),
) {
  const budget = quizBudget(bank.length, classroom.quizLength);
  const recentMisses = await listRecentMisses(
    db,
    userId,
    classroom.id,
    new Date(now.getTime() - 30 * DAY_MS),
  );
  const { chosen, spares } = selectCompositionPoints(bank, {
    budget,
    now,
    lastQuizzedAt: await listLastQuizzedByPoint(db, classroom.id),
    missedIds: recentMisses.map((miss) => miss.knowledgePointId),
  });
  const selected = [...chosen, ...spares];
  const selectedIds = new Set(selected.map((point) => point.id));

  const payload = {
    targetLanguage: classroom.targetLanguage,
    nativeLanguage: classroom.nativeLanguage,
    size: chosen.length,
    knowledgePoints: selected.map((point) => ({
      id: point.id,
      category: point.category,
      target: point.targetText,
      native: point.nativeText,
      detail: point.detail,
    })),
    alreadyAskedStems: await listWeekQuestionStems(
      db,
      classroom.id,
      new Date(now.getTime() - 7 * DAY_MS),
    ),
    recentMisses: recentMisses.filter((miss) => selectedIds.has(miss.knowledgePointId)),
  };
  return { budget, chosen, selected, payload };
}

export async function handleComposeJob(
  db: Db,
  payload: Record<string, unknown>,
  jobId?: string,
): Promise<void> {
  const classroomId = requireString(payload, "classroomId");
  const userId = requireString(payload, "userId");
  const localDate = requireString(payload, "localDate");
  if (payload.source === "exam") {
    await composeExam(db, { classroomId, userId, localDate }, jobId);
    return;
  }
  const kind = payload.source === "manual" ? "manual" : "daily";
  const sendAt = kind === "daily" ? dailyCutoff(payload) : null;

  if (await cancelIfRequested(db, jobId)) {
    console.log(`[worker] compose ${classroomId} ${localDate}: cancelled before start`);
    return;
  }

  if (kind === "daily") {
    const existing = await getDailyQuizByClassroomAndDate(db, classroomId, localDate);
    if (existing) {
      return;
    }
    if (await hasDeletedDailyQuiz(db, classroomId, localDate)) {
      console.log(`[worker] compose ${classroomId} ${localDate}: deleted by user, skipping`);
      return;
    }
  }

  const classroom = await getClassroom(db, userId, classroomId);
  if (!classroom) {
    throw new Error(`classroom ${classroomId} not found for user ${userId}`);
  }
  if (kind === "daily" && sendAt && blocksDailyComposition(classroom, sendAt)) {
    console.log(`[worker] compose ${classroomId} ${localDate}: daily reviews paused or deferred`);
    return;
  }

  const bank = await listKnowledgePointsForComposition(db, classroomId);
  if (bank.length === 0) {
    console.log(`[worker] compose ${classroomId} ${localDate}: empty bank, nothing to compose`);
    return;
  }
  const { budget, selected, payload: compositionPayload } = await buildDailyCompositionInput(
    db,
    userId,
    classroom,
    bank,
  );
  const selectedIds = new Set(selected.map((point) => point.id));

  const provider = getLlmProvider();
  const raw = await provider.compose({
    systemPrompt: COMPOSITION_PROMPT_V4,
    payload: compositionPayload,
  });
  const parsed = typeof raw === "string" ? parseCompositionResponse(raw) : parseCompositionResult(raw);

  const { kept: sanitized, dropped } = sanitizeCompositionQuestions(parsed.questions, selectedIds);
  let usable = sanitized;
  let reviewNote = "";
  if (env.judgeProvider === "jev") {
    const review = await reviewAndRewrite({
      jev: createJevClient(),
      provider,
      payload: compositionPayload,
      questions: sanitized,
    });
    // Rejected questions come back only when the quiz would otherwise be too short to send.
    const shortBy = Math.max(0, MIN_USABLE_QUESTIONS - review.kept.length);
    usable = [...review.kept, ...review.rejected.slice(0, shortBy).map((entry) => entry.question)];
    reviewNote = `, review ${JSON.stringify(review.stats)}`;
  }
  const categoryById = new Map(selected.map((point) => [point.id, point.category]));
  const kept = fitToBudget(
    usable,
    budget,
    (question) => categoryById.get(question.knowledge_point_id) ?? question.category,
  );
  if (kept.length < MIN_USABLE_QUESTIONS) {
    throw new Error(`only ${kept.length} usable questions`);
  }

  const detailById = new Map(bank.map((point) => [point.id, point.detail]));
  const questions: Omit<NewQuestion, "quizId">[] = shuffleQuizQuestions(
    kept.map((question) => ({
      knowledgePointId: question.knowledge_point_id,
      passageId: passageIdFromDetail(detailById.get(question.knowledge_point_id) ?? null),
      category: question.category,
      type: question.type,
      stem: question.stem,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      promptVersion: COMPOSITION_PROMPT_VERSION,
    })),
  ).map((question, index) => ({ ...question, position: index }));

  if (await cancelIfRequested(db, jobId)) {
    console.log(`[worker] compose ${classroomId} ${localDate}: cancelled before save`);
    return;
  }

  if (kind === "daily" && sendAt) {
    const latestClassroom = await getClassroom(db, userId, classroomId);
    if (!latestClassroom || blocksDailyComposition(latestClassroom, sendAt)) {
      console.log(`[worker] compose ${classroomId} ${localDate}: paused before save`);
      return;
    }
  }

  const { quiz, blocked } = await createQuizWithQuestions(db, {
    classroomId,
    userId,
    quizDate: localDate,
    kind,
    size: kept.length,
    promptVersion: COMPOSITION_PROMPT_VERSION,
    questions,
    dailySendAt: sendAt ?? undefined,
  });
  if (blocked) {
    console.log(`[worker] compose ${classroomId} ${localDate}: blocked at save`);
    return;
  }
  if (!quiz) {
    throw new Error(`failed to create quiz for classroom ${classroomId} on ${localDate}`);
  }

  if (kind === "manual") {
    if (jobId) {
      await recordJobResult(db, jobId, { quizId: quiz.id });
    }
    await enqueueJob(db, {
      kind: "send_email",
      payload: { userId, quizDate: localDate, kind, quizId: quiz.id },
    });
  }
  console.log(
    `[worker] compose ${kind} ${classroomId} ${localDate}: ${kept.length} questions (${dropped.length} dropped${reviewNote})`,
  );
}

// An exam follows a fixed blueprint worth 100 points. It sends no email; the
// classroom hub polls the job and opens the paper when it is ready.
async function composeExam(
  db: Db,
  { classroomId, userId, localDate }: { classroomId: string; userId: string; localDate: string },
  jobId?: string,
): Promise<void> {
  if (await cancelIfRequested(db, jobId)) {
    console.log(`[worker] compose exam ${classroomId}: cancelled before start`);
    return;
  }
  const classroom = await getClassroom(db, userId, classroomId);
  if (!classroom) {
    throw new Error(`classroom ${classroomId} not found for user ${userId}`);
  }
  const bank = await listKnowledgePointsForComposition(db, classroomId);
  const now = new Date();
  const recentMisses = await listRecentMisses(
    db,
    userId,
    classroomId,
    new Date(now.getTime() - 30 * DAY_MS),
  );
  const selected = selectExamPoints(bank, {
    lastQuizzedAt: await listLastQuizzedByPoint(db, classroomId),
    missedIds: recentMisses.map((miss) => miss.knowledgePointId),
  });
  const selectedIds = new Set(selected.map(({ point }) => point.id));
  const typeById = new Map(selected.map(({ point, type }) => [point.id, type]));

  const provider = getLlmProvider();
  const raw = await provider.compose({
    systemPrompt: EXAM_PROMPT_V2,
    payload: {
      targetLanguage: classroom.targetLanguage,
      nativeLanguage: classroom.nativeLanguage,
      size: selected.length,
      knowledgePoints: selected.map(({ point, type }) => ({
        id: point.id,
        category: point.category,
        type,
        target: point.targetText,
        native: point.nativeText,
        detail: point.detail,
      })),
      alreadyAskedStems: await listWeekQuestionStems(
        db,
        classroomId,
        new Date(now.getTime() - 7 * DAY_MS),
      ),
      recentMisses: recentMisses.filter((miss) => selectedIds.has(miss.knowledgePointId)),
    },
  });
  const parsed = typeof raw === "string" ? parseCompositionResponse(raw) : parseCompositionResult(raw);
  const { kept: usable, dropped } = sanitizeCompositionQuestions(parsed.questions, selectedIds);
  // A question in a type other than the one its point was given would unbalance the paper.
  const paper = fillExamBlueprint(
    usable.filter((question) => typeById.get(question.knowledge_point_id) === question.type),
  );
  if (!paper) {
    throw new Error(`exam blueprint not filled from ${usable.length} usable questions`);
  }

  if (await cancelIfRequested(db, jobId)) {
    console.log(`[worker] compose exam ${classroomId}: cancelled before save`);
    return;
  }
  const detailById = new Map(bank.map((point) => [point.id, point.detail]));
  const { quiz } = await createQuizWithQuestions(db, {
    classroomId,
    userId,
    quizDate: localDate,
    kind: "exam",
    size: paper.length,
    promptVersion: EXAM_PROMPT_VERSION,
    questions: paper.map((question, index) => ({
      knowledgePointId: question.knowledge_point_id,
      passageId: passageIdFromDetail(detailById.get(question.knowledge_point_id) ?? null),
      category: question.category,
      type: question.type,
      stem: question.stem,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      promptVersion: EXAM_PROMPT_VERSION,
      position: index,
    })),
  });
  if (!quiz) {
    throw new Error(`failed to create exam for classroom ${classroomId}`);
  }
  if (jobId) {
    await recordJobResult(db, jobId, { quizId: quiz.id });
  }
  console.log(
    `[worker] compose exam ${classroomId}: ${paper.length} questions (${dropped.length} dropped)`,
  );
}
