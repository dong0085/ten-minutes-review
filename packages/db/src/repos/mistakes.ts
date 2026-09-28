import { and, eq, sql } from "drizzle-orm";
import { MISTAKE_WINDOW_DAYS } from "@tmr/core";
import type { Category, QuestionAnswer, QuestionResponse, QuestionType, QuizKind } from "@tmr/core";
import type { Db } from "../client";
import { mistakePractice, questions, quizzes } from "../schema/quizzes";

export type MistakeRow = {
  questionId: string;
  knowledgePointId: string;
  category: Category;
  type: QuestionType;
  stem: string;
  options: string[] | null;
  quizId: string;
  quizKind: QuizKind;
  quizDate: string;
  firstMissedAt: Date;
  missCount: number;
};

/*
 * Every answer to a classroom's questions in the window, from quizzes and from
 * the mistake book. A question is open when a quiz or exam missed it in the
 * window and its latest answer anywhere is still wrong.
 */
function openMistakesSql(userId: string, classroomId: string) {
  return sql`
    WITH answers AS (
      SELECT aa.question_id, aa.is_correct, a.submitted_at AS answered_at, true AS from_paper
      FROM attempt_answers aa
      JOIN attempts a ON a.id = aa.attempt_id
      JOIN questions q ON q.id = aa.question_id
      JOIN quizzes z ON z.id = q.quiz_id
      WHERE a.user_id = ${userId}
        AND z.classroom_id = ${classroomId}
        AND a.submitted_at >= now() - (${MISTAKE_WINDOW_DAYS} * interval '1 day')
      UNION ALL
      SELECT mp.question_id, mp.is_correct, mp.created_at, false
      FROM mistake_practice mp
      WHERE mp.user_id = ${userId}
        AND mp.classroom_id = ${classroomId}
        AND mp.created_at >= now() - (${MISTAKE_WINDOW_DAYS} * interval '1 day')
    ),
    tally AS (
      SELECT
        question_id,
        min(answered_at) FILTER (WHERE from_paper AND NOT is_correct) AS first_missed_at,
        count(*) FILTER (WHERE NOT is_correct)::int AS miss_count,
        max(answered_at) FILTER (WHERE NOT is_correct) AS last_missed_at,
        max(answered_at) FILTER (WHERE is_correct) AS last_right_at
      FROM answers
      GROUP BY question_id
    )
    SELECT question_id, first_missed_at, miss_count
    FROM tally
    WHERE first_missed_at IS NOT NULL
      AND (last_right_at IS NULL OR last_right_at < last_missed_at)
  `;
}

/** The classroom's mistake book, oldest miss first, as it stood on the paper. */
export async function listOpenMistakes(
  db: Db,
  userId: string,
  classroomId: string,
): Promise<MistakeRow[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT
      q.id AS "questionId",
      q.knowledge_point_id AS "knowledgePointId",
      q.category AS "category",
      q.type AS "type",
      q.stem AS "stem",
      q.options AS "options",
      z.id AS "quizId",
      z.kind AS "quizKind",
      to_char(z.quiz_date, 'YYYY-MM-DD') AS "quizDate",
      m.first_missed_at AS "firstMissedAt",
      m.miss_count AS "missCount"
    FROM (${openMistakesSql(userId, classroomId)}) m
    JOIN questions q ON q.id = m.question_id
    JOIN quizzes z ON z.id = q.quiz_id
    ORDER BY m.first_missed_at, q.position
  `);
  return Array.from(rows).map((row) => ({
    ...(row as unknown as MistakeRow),
    firstMissedAt: new Date(row.firstMissedAt as string),
    missCount: Number(row.missCount),
  }));
}

export async function countOpenMistakes(db: Db, userId: string, classroomId: string) {
  const rows = await db.execute<{ value: number }>(sql`
    SELECT count(*)::int AS value FROM (${openMistakesSql(userId, classroomId)}) m
  `);
  return Number(Array.from(rows)[0]?.value ?? 0);
}

/** Require a question to be in the open book before revealing its answer. */
export async function isOpenMistake(
  db: Db,
  userId: string,
  classroomId: string,
  questionId: string,
) {
  const rows = await db.execute<{ value: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM (${openMistakesSql(userId, classroomId)}) m
      WHERE m.question_id = ${questionId}
    ) AS value
  `);
  return Array.from(rows)[0]?.value === true;
}

/** One of the classroom's questions, with its answer, for grading a mistake-book answer. */
export async function getClassroomQuestion(
  db: Db,
  userId: string,
  classroomId: string,
  questionId: string,
) {
  const [row] = await db
    .select({
      id: questions.id,
      type: questions.type,
      answer: questions.answer,
      explanation: questions.explanation,
    })
    .from(questions)
    .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
    .where(
      and(
        eq(questions.id, questionId),
        eq(quizzes.classroomId, classroomId),
        eq(quizzes.userId, userId),
      ),
    )
    .limit(1);
  return (row ?? null) as {
    id: string;
    type: QuestionType;
    answer: QuestionAnswer;
    explanation: string;
  } | null;
}

export async function recordMistakePractice(
  db: Db,
  input: {
    userId: string;
    classroomId: string;
    questionId: string;
    response: QuestionResponse;
    isCorrect: boolean;
  },
) {
  await db.insert(mistakePractice).values(input);
}
