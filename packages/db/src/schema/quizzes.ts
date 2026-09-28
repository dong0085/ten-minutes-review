import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  Category,
  ExamReview,
  QuestionAnswer,
  QuestionResponse,
  QuestionType,
  QuizKind,
} from "@tmr/core";
import { users } from "./users";
import { classrooms } from "./classrooms";
import { knowledgePoints, passages } from "./bank";

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quizDate: date("quiz_date", { mode: "string" }).notNull(),
    kind: text("kind").$type<QuizKind>().notNull().default("daily"),
    size: integer("size").notNull(),
    promptVersion: text("prompt_version").notNull(),
    composedAt: timestamp("composed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quizzes_classroom_date_daily_idx")
      .on(table.classroomId, table.quizDate)
      .where(sql`kind = 'daily'`),
    index("quizzes_user_kind_composed_idx").on(
      table.userId,
      table.kind,
      table.composedAt,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    knowledgePointId: uuid("knowledge_point_id")
      .notNull()
      .references(() => knowledgePoints.id, { onDelete: "cascade" }),
    passageId: uuid("passage_id").references(() => passages.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    category: text("category").$type<Category>().notNull(),
    type: text("type").$type<QuestionType>().notNull(),
    stem: text("stem").notNull(),
    options: jsonb("options").$type<string[] | null>(),
    answer: jsonb("answer").$type<QuestionAnswer>().notNull(),
    explanation: text("explanation").notNull(),
    promptVersion: text("prompt_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("questions_quiz_position_idx").on(table.quizId, table.position)],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer("duration_ms").notNull(),
    correctCount: integer("correct_count").notNull(),
    questionCount: integer("question_count").notNull(),
    /** The AI review of an exam's mistakes, written by a `summarize` job after submit. */
    review: jsonb("review").$type<ExamReview>(),
    reviewPromptVersion: text("review_prompt_version"),
  },
  (table) => [
    index("attempts_quiz_idx").on(table.quizId),
    index("attempts_user_idx").on(table.userId),
  ],
);

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    response: jsonb("response").$type<QuestionResponse>(),
    isCorrect: boolean("is_correct").notNull(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("attempt_answers_attempt_idx").on(table.attemptId)],
);

export const deletedDailyQuizzes = pgTable(
  "deleted_daily_quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quizDate: date("quiz_date", { mode: "string" }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("deleted_daily_quizzes_classroom_date_idx").on(
      table.classroomId,
      table.quizDate,
    ),
    index("deleted_daily_quizzes_user_idx").on(table.userId),
  ],
);

export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type AttemptAnswer = typeof attemptAnswers.$inferSelect;
export type NewAttemptAnswer = typeof attemptAnswers.$inferInsert;
export type DeletedDailyQuiz = typeof deletedDailyQuizzes.$inferSelect;
export type NewDeletedDailyQuiz = typeof deletedDailyQuizzes.$inferInsert;
