import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type {
  Category,
  QuestionAnswer,
  QuestionResponse,
  QuestionType,
  QuizKind,
} from "@tmr/core";
import type { Db } from "../client";
import { classrooms } from "../schema/classrooms";
import {
  attempts,
  attemptAnswers,
  deletedDailyQuizzes,
  questions,
  quizzes,
} from "../schema/quizzes";
import type { NewAttemptAnswer, NewQuestion } from "../schema/quizzes";

export type NewQuizInput = {
  classroomId: string;
  userId: string;
  quizDate: string;
  kind: QuizKind;
  size: number;
  promptVersion: string;
  questions: Omit<NewQuestion, "quizId">[];
  dailySendAt?: Date;
};

export async function getDailyQuizByClassroomAndDate(
  db: Db,
  classroomId: string,
  quizDate: string,
) {
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(
      and(
        eq(quizzes.classroomId, classroomId),
        eq(quizzes.quizDate, quizDate),
        eq(quizzes.kind, "daily"),
      ),
    )
    .limit(1);
  return quiz ?? null;
}

export async function createQuizWithQuestions(db: Db, input: NewQuizInput) {
  return db.transaction(async (tx) => {
    if (input.kind === "daily") {
      const conditions = [
        eq(classrooms.id, input.classroomId),
        isNull(classrooms.pausedAt),
      ];
      if (input.dailySendAt) {
        const encodedSendAt = sql.param(input.dailySendAt, classrooms.createdAt);
        conditions.push(
          sql`COALESCE(${classrooms.dailyResumedAt}, ${classrooms.createdAt}) < ${encodedSendAt}`,
        );
      }
      const [eligible] = await tx
        .select({ id: classrooms.id })
        .from(classrooms)
        .where(and(...conditions))
        .for("update")
        .limit(1);
      if (!eligible) {
        return { quiz: null, created: false, blocked: true };
      }
    }

    const inserted = await tx
      .insert(quizzes)
      .values({
        classroomId: input.classroomId,
        userId: input.userId,
        quizDate: input.quizDate,
        kind: input.kind,
        size: input.size,
        promptVersion: input.promptVersion,
      })
      .onConflictDoNothing()
      .returning();
    const quiz = inserted[0];
    if (!quiz) {
      const [existing] = await tx
        .select()
        .from(quizzes)
        .where(
          and(
            eq(quizzes.classroomId, input.classroomId),
            eq(quizzes.quizDate, input.quizDate),
            eq(quizzes.kind, "daily"),
          ),
        )
        .limit(1);
      return { quiz: existing ?? null, created: false, blocked: false };
    }
    if (input.questions.length > 0) {
      await tx.insert(questions).values(
        input.questions.map((question, index) => ({
          ...question,
          quizId: quiz.id,
          position: question.position ?? index,
        })),
      );
    }
    return { quiz, created: true, blocked: false };
  });
}

export async function getQuizForUser(db: Db, userId: string, quizId: string) {
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
    .limit(1);
  return quiz ?? null;
}

export async function hasDeletedDailyQuiz(db: Db, classroomId: string, quizDate: string) {
  const [row] = await db
    .select({ id: deletedDailyQuizzes.id })
    .from(deletedDailyQuizzes)
    .where(
      and(
        eq(deletedDailyQuizzes.classroomId, classroomId),
        eq(deletedDailyQuizzes.quizDate, quizDate),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function deleteQuizForUser(db: Db, userId: string, quizId: string) {
  const quiz = await getQuizForUser(db, userId, quizId);
  if (!quiz) {
    return false;
  }
  await db.transaction(async (tx) => {
    if (quiz.kind === "daily") {
      await tx
        .insert(deletedDailyQuizzes)
        .values({
          classroomId: quiz.classroomId,
          userId: quiz.userId,
          quizDate: quiz.quizDate,
        })
        .onConflictDoNothing();
    }
    await tx
      .delete(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)));
  });
  return true;
}

export async function getQuizWithQuestionsForUser(db: Db, userId: string, quizId: string) {
  const quiz = await getQuizForUser(db, userId, quizId);
  if (!quiz) {
    return null;
  }
  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.position));
  return { quiz, questions: rows };
}

export async function listQuizzesForClassroom(
  db: Db,
  userId: string,
  classroomId: string,
) {
  return db
    .select({
      id: quizzes.id,
      quizDate: quizzes.quizDate,
      kind: quizzes.kind,
      size: quizzes.size,
      composedAt: quizzes.composedAt,
      bestScore: sql<number | null>`max(${attempts.correctCount})::int`,
      attemptCount: sql<number>`count(${attempts.id})::int`,
    })
    .from(quizzes)
    .leftJoin(attempts, eq(attempts.quizId, quizzes.id))
    .where(and(eq(quizzes.classroomId, classroomId), eq(quizzes.userId, userId)))
    .groupBy(quizzes.id)
    .orderBy(desc(quizzes.composedAt));
}

export async function listUntakenOnDemandQuizzes(
  db: Db,
  classroomId: string,
  limit = 3,
) {
  return db
    .select({
      id: quizzes.id,
      quizDate: quizzes.quizDate,
      kind: quizzes.kind,
      size: quizzes.size,
      composedAt: quizzes.composedAt,
    })
    .from(quizzes)
    .leftJoin(attempts, eq(attempts.quizId, quizzes.id))
    .where(
      and(
        eq(quizzes.classroomId, classroomId),
        eq(quizzes.kind, "manual"),
      ),
    )
    .groupBy(quizzes.id)
    .having(sql`count(${attempts.id}) = 0`)
    .orderBy(desc(quizzes.composedAt))
    .limit(limit);
}

export async function countManualQuizzes(
  db: Db,
  userId: string,
  since: Date,
  classroomId?: string,
) {
  const conditions = [
    eq(quizzes.userId, userId),
    eq(quizzes.kind, "manual"),
    gte(quizzes.composedAt, since),
  ];
  if (classroomId) {
    conditions.push(eq(quizzes.classroomId, classroomId));
  }
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(quizzes)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

export async function listQuizzesForUser(db: Db, userId: string, limit = 100) {
  return db
    .select({
      id: quizzes.id,
      classroomId: quizzes.classroomId,
      classroomName: classrooms.name,
      quizDate: quizzes.quizDate,
      size: quizzes.size,
      bestScore: sql<number | null>`max(${attempts.correctCount})::int`,
      attemptCount: sql<number>`count(${attempts.id})::int`,
    })
    .from(quizzes)
    .innerJoin(classrooms, eq(quizzes.classroomId, classrooms.id))
    .leftJoin(attempts, eq(attempts.quizId, quizzes.id))
    .where(eq(quizzes.userId, userId))
    .groupBy(quizzes.id, classrooms.name)
    .orderBy(desc(quizzes.quizDate))
    .limit(limit);
}

export type NewAttemptInput = {
  quizId: string;
  userId: string;
  startedAt: Date;
  durationMs: number;
  correctCount: number;
  questionCount: number;
  answers: {
    questionId: string;
    response: QuestionResponse;
    isCorrect: boolean;
    durationMs: number | null;
  }[];
};

export async function createAttemptWithAnswers(db: Db, input: NewAttemptInput) {
  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .insert(attempts)
      .values({
        quizId: input.quizId,
        userId: input.userId,
        startedAt: input.startedAt,
        durationMs: input.durationMs,
        correctCount: input.correctCount,
        questionCount: input.questionCount,
      })
      .returning();
    if (!attempt) {
      return null;
    }
    if (input.answers.length > 0) {
      const rows: NewAttemptAnswer[] = input.answers.map((answer) => ({
        attemptId: attempt.id,
        questionId: answer.questionId,
        response: answer.response,
        isCorrect: answer.isCorrect,
        durationMs: answer.durationMs,
      }));
      await tx.insert(attemptAnswers).values(rows);
    }
    return attempt;
  });
}

export async function getAttemptForUser(db: Db, userId: string, attemptId: string) {
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
    .limit(1);
  return attempt ?? null;
}

export type ReviewAnswer = {
  questionId: string;
  response: QuestionResponse | null;
  isCorrect: boolean;
  durationMs: number | null;
  position: number;
  category: Category;
  type: QuestionType;
  stem: string;
  options: string[] | null;
  answer: QuestionAnswer;
  explanation: string;
};

export async function getAttemptReview(db: Db, userId: string, attemptId: string) {
  const attempt = await getAttemptForUser(db, userId, attemptId);
  if (!attempt) {
    return null;
  }
  const rows = await db
    .select({
      questionId: questions.id,
      response: attemptAnswers.response,
      isCorrect: attemptAnswers.isCorrect,
      durationMs: attemptAnswers.durationMs,
      position: questions.position,
      category: questions.category,
      type: questions.type,
      stem: questions.stem,
      options: questions.options,
      answer: questions.answer,
      explanation: questions.explanation,
    })
    .from(attemptAnswers)
    .innerJoin(questions, eq(attemptAnswers.questionId, questions.id))
    .where(eq(attemptAnswers.attemptId, attemptId))
    .orderBy(asc(questions.position));
  return { attempt, answers: rows as ReviewAnswer[] };
}

export async function listAttemptsForQuiz(db: Db, userId: string, quizId: string) {
  return db
    .select()
    .from(attempts)
    .where(and(eq(attempts.quizId, quizId), eq(attempts.userId, userId)))
    .orderBy(desc(attempts.submittedAt));
}

export async function countAttemptsForQuizOnDate(
  db: Db,
  userId: string,
  quizId: string,
  date: string,
) {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.quizId, quizId),
        sql`(${attempts.submittedAt} AT TIME ZONE 'UTC')::date = ${date}::date`,
      ),
    );
  return Number(row?.value ?? 0);
}

export async function listQuizzesForUserOnDate(
  db: Db,
  userId: string,
  quizDate: string,
) {
  return db
    .select({ quiz: quizzes, classroomName: classrooms.name })
    .from(quizzes)
    .innerJoin(classrooms, eq(quizzes.classroomId, classrooms.id))
    .where(
      and(
        eq(quizzes.userId, userId),
        eq(quizzes.quizDate, quizDate),
        eq(quizzes.kind, "daily"),
      ),
    )
    .orderBy(asc(classrooms.name));
}

export async function listDailyEmailQuizzesForUserOnDate(
  db: Db,
  userId: string,
  quizDate: string,
  sendAt: Date,
) {
  const encodedSendAt = sql.param(sendAt, classrooms.createdAt);
  return db
    .select({ quiz: quizzes, classroomName: classrooms.name })
    .from(quizzes)
    .innerJoin(classrooms, eq(quizzes.classroomId, classrooms.id))
    .where(
      and(
        eq(quizzes.userId, userId),
        eq(quizzes.quizDate, quizDate),
        eq(quizzes.kind, "daily"),
        isNull(classrooms.archivedAt),
        isNull(classrooms.pausedAt),
        sql`COALESCE(${classrooms.dailyResumedAt}, ${classrooms.createdAt}) < ${encodedSendAt}`,
      ),
    )
    .orderBy(asc(classrooms.name));
}

export async function listQuestionsByKnowledgePoint(
  db: Db,
  classroomId: string,
  knowledgePointId: string,
) {
  return db
    .select({ id: questions.id, stem: questions.stem, type: questions.type })
    .from(questions)
    .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
    .where(
      and(
        eq(quizzes.classroomId, classroomId),
        eq(questions.knowledgePointId, knowledgePointId),
      ),
    );
}
