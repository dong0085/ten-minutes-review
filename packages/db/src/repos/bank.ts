import { and, asc, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { Category } from "@tmr/core";
import type { Db } from "../client";
import { classrooms } from "../schema/classrooms";
import { knowledgePoints, passages } from "../schema/bank";
import type { NewKnowledgePoint, NewPassage } from "../schema/bank";
import { questions } from "../schema/quizzes";
import { quizzes } from "../schema/quizzes";
import { attempts, attemptAnswers } from "../schema/quizzes";

export async function insertPassages(db: Db, rows: NewPassage[]) {
  if (rows.length === 0) {
    return [];
  }
  return db.insert(passages).values(rows).returning();
}

export async function insertKnowledgePoints(db: Db, rows: NewKnowledgePoint[]) {
  if (rows.length === 0) {
    return [];
  }
  return db.insert(knowledgePoints).values(rows).returning();
}

export async function setKnowledgePointRetired(
  db: Db,
  userId: string,
  knowledgePointId: string,
  retired: boolean = true,
) {
  const [point] = await db
    .select({
      id: knowledgePoints.id,
      classroomId: knowledgePoints.classroomId,
      retiredAt: knowledgePoints.retiredAt,
      targetText: knowledgePoints.targetText,
    })
    .from(knowledgePoints)
    .innerJoin(classrooms, eq(knowledgePoints.classroomId, classrooms.id))
    .where(and(eq(knowledgePoints.id, knowledgePointId), eq(classrooms.userId, userId)))
    .limit(1);

  if (!point) {
    return null;
  }

  const retiredAt = retired ? new Date() : null;
  const [updated] = await db
    .update(knowledgePoints)
    .set({ retiredAt })
    .where(eq(knowledgePoints.id, knowledgePointId))
    .returning({
      id: knowledgePoints.id,
      classroomId: knowledgePoints.classroomId,
      retiredAt: knowledgePoints.retiredAt,
      targetText: knowledgePoints.targetText,
    });

  return updated ?? null;
}

export async function updateKnowledgePointText(
  db: Db,
  userId: string,
  knowledgePointId: string,
  fields: { targetText?: string; nativeText?: string | null; note?: string | null },
) {
  const [point] = await db
    .select({ id: knowledgePoints.id })
    .from(knowledgePoints)
    .innerJoin(classrooms, eq(knowledgePoints.classroomId, classrooms.id))
    .where(and(eq(knowledgePoints.id, knowledgePointId), eq(classrooms.userId, userId)))
    .limit(1);

  if (!point) {
    return null;
  }

  const [updated] = await db
    .update(knowledgePoints)
    .set(fields)
    .where(eq(knowledgePoints.id, knowledgePointId))
    .returning();

  return updated ?? null;
}

// Every knowledge point in the classroom, omitted ones included, with how often
// the learner answered questions built on it.
export async function listBankForUser(db: Db, userId: string, classroomId: string) {
  return db
    .select({
      point: knowledgePoints,
      answered: sql<number>`count(${attemptAnswers.id})::int`,
      missed: sql<number>`count(${attemptAnswers.id}) filter (where ${attemptAnswers.isCorrect} = false)::int`,
    })
    .from(knowledgePoints)
    .innerJoin(classrooms, eq(knowledgePoints.classroomId, classrooms.id))
    .leftJoin(questions, eq(questions.knowledgePointId, knowledgePoints.id))
    .leftJoin(attemptAnswers, eq(attemptAnswers.questionId, questions.id))
    .where(and(eq(knowledgePoints.classroomId, classroomId), eq(classrooms.userId, userId)))
    .groupBy(knowledgePoints.id)
    .orderBy(desc(knowledgePoints.createdAt), asc(knowledgePoints.id));
}

export async function listKnowledgePointsForUser(
  db: Db,
  userId: string,
  classroomId: string,
) {
  return db
    .select({ point: knowledgePoints })
    .from(knowledgePoints)
    .innerJoin(classrooms, eq(knowledgePoints.classroomId, classrooms.id))
    .where(
      and(
        eq(knowledgePoints.classroomId, classroomId),
        eq(classrooms.userId, userId),
        isNull(knowledgePoints.retiredAt),
      ),
    )
    .orderBy(desc(knowledgePoints.createdAt));
}

export async function listKnowledgePointsForComposition(db: Db, classroomId: string) {
  return db
    .select()
    .from(knowledgePoints)
    .where(and(eq(knowledgePoints.classroomId, classroomId), isNull(knowledgePoints.retiredAt)))
    .orderBy(desc(knowledgePoints.createdAt));
}

export async function listLastQuizzedByPoint(db: Db, classroomId: string) {
  const rows = await db
    .select({
      knowledgePointId: questions.knowledgePointId,
      lastQuizzedAt: sql<string>`max(${quizzes.composedAt})`,
    })
    .from(questions)
    .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
    .where(eq(quizzes.classroomId, classroomId))
    .groupBy(questions.knowledgePointId);
  return new Map(rows.map((row) => [row.knowledgePointId, new Date(row.lastQuizzedAt)]));
}

export async function bankSize(db: Db, classroomId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(knowledgePoints)
    .where(and(eq(knowledgePoints.classroomId, classroomId), isNull(knowledgePoints.retiredAt)));
  return Number(row?.value ?? 0);
}

export async function countBankByCategory(db: Db, userId: string, classroomId: string) {
  const rows = await db
    .select({
      category: knowledgePoints.category,
      value: sql<number>`count(*)::int`,
    })
    .from(knowledgePoints)
    .innerJoin(classrooms, eq(knowledgePoints.classroomId, classrooms.id))
    .where(
      and(
        eq(knowledgePoints.classroomId, classroomId),
        eq(classrooms.userId, userId),
        isNull(knowledgePoints.retiredAt),
      ),
    )
    .groupBy(knowledgePoints.category);
  return rows as { category: Category; value: number }[];
}

export async function listWeekQuestionStems(db: Db, classroomId: string, since: Date) {
  const rows = await db
    .select({ stem: questions.stem })
    .from(questions)
    .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
    .where(and(eq(quizzes.classroomId, classroomId), gte(quizzes.composedAt, since)))
    .orderBy(desc(quizzes.composedAt));
  return rows.map((row) => row.stem);
}

export async function listRecentMisses(
  db: Db,
  userId: string,
  classroomId: string,
  since: Date,
) {
  return db
    .select({
      knowledgePointId: questions.knowledgePointId,
      stem: questions.stem,
    })
    .from(attemptAnswers)
    .innerJoin(attempts, eq(attemptAnswers.attemptId, attempts.id))
    .innerJoin(questions, eq(attemptAnswers.questionId, questions.id))
    .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
    .where(
      and(
        eq(attempts.userId, userId),
        eq(quizzes.classroomId, classroomId),
        eq(attemptAnswers.isCorrect, false),
        gte(attempts.submittedAt, since),
      ),
    )
    .orderBy(desc(attempts.submittedAt))
    .limit(20);
}

export async function listPassagesForClassroom(db: Db, classroomId: string) {
  return db
    .select()
    .from(passages)
    .where(eq(passages.classroomId, classroomId))
    .orderBy(asc(passages.createdAt));
}

export async function countPassagesForClassroom(db: Db, classroomId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(passages)
    .where(eq(passages.classroomId, classroomId));
  return Number(row?.value ?? 0);
}
