import { eq, inArray } from "drizzle-orm";
import type { Category, QuestionType } from "@tmr/core";
import {
  getClassroom,
  getQuizWithQuestionsForUser,
  knowledgePoints,
  questions,
  uploads,
} from "@tmr/db";
import { getDb } from "@/lib/db";
import { objectUrl } from "@/lib/storage";

export type QuizQuestionPayload = {
  id: string;
  position: number;
  category: Category;
  type: QuestionType;
  stem: string;
  options: string[] | null;
  imageUrl: string | null;
  knowledgePointId: string;
  isKnowledgePointRetired: boolean;
};

export type QuizPayload = {
  id: string;
  quizDate: string;
  size: number;
  classroomId: string;
  classroomName: string;
  questions: QuizQuestionPayload[];
};

export function localDateFor(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function buildQuizPayload(
  userId: string,
  quizId: string,
): Promise<QuizPayload | null> {
  const db = getDb();
  const row = await getQuizWithQuestionsForUser(db, userId, quizId);
  if (!row) {
    return null;
  }
  const classroom = await getClassroom(db, userId, row.quiz.classroomId);
  if (!classroom) {
    return null;
  }

  const imageQuestionIds = row.questions
    .filter((question) => question.type === "image")
    .map((question) => question.id);
  const storageKeyByQuestion = new Map<string, string>();
  if (imageQuestionIds.length > 0) {
    const imageRows = await db
      .select({ questionId: questions.id, storageKey: uploads.storageKey })
      .from(questions)
      .innerJoin(knowledgePoints, eq(questions.knowledgePointId, knowledgePoints.id))
      .innerJoin(uploads, eq(knowledgePoints.sourceUploadId, uploads.id))
      .where(inArray(questions.id, imageQuestionIds));
    for (const imageRow of imageRows) {
      if (imageRow.storageKey) {
        storageKeyByQuestion.set(imageRow.questionId, imageRow.storageKey);
      }
    }
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

  const questionPayloads = await Promise.all(
    row.questions.map(async (question): Promise<QuizQuestionPayload> => {
      const storageKey = storageKeyByQuestion.get(question.id);
      const imageUrl =
        question.type === "image" && storageKey
          ? await objectUrl(storageKey).catch(() => null)
          : null;
      return {
        id: question.id,
        position: question.position,
        category: question.category,
        type: question.type,
        stem: question.stem,
        options: question.options ?? null,
        imageUrl,
        knowledgePointId: question.knowledgePointId,
        isKnowledgePointRetired: retiredPointIds.has(question.knowledgePointId),
      };
    }),
  );

  return {
    id: row.quiz.id,
    quizDate: row.quiz.quizDate,
    size: row.quiz.size,
    classroomId: row.quiz.classroomId,
    classroomName: classroom.name,
    questions: questionPayloads,
  };
}
