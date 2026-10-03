import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Category, KnowledgePointDetail } from "@tmr/core";
import { classrooms, uploads } from "./classrooms";

export const knowledgePoints = pgTable(
  "knowledge_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    sourceUploadId: uuid("source_upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    category: text("category").$type<Category>().notNull(),
    targetText: text("target_text").notNull(),
    nativeText: text("native_text"),
    inferred: boolean("inferred").notNull().default(false),
    note: text("note"),
    detail: jsonb("detail").$type<KnowledgePointDetail>(),
    sourceExcerpt: text("source_excerpt"),
    promptVersion: text("prompt_version").notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    /** Set, together with retired_at, when an edit to its note replaced the point. */
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    /** Set when the learner edits the point by hand; re-reads never overwrite it. */
    userEditedAt: timestamp("user_edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("knowledge_points_classroom_created_idx").on(table.classroomId, table.createdAt)],
);

export const passages = pgTable(
  "passages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    sourceUploadId: uuid("source_upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    targetText: text("target_text").notNull(),
    nativeText: text("native_text"),
    sourceExcerpt: text("source_excerpt"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("passages_classroom_idx").on(table.classroomId)],
);

/** One line of a typed note. Points and passages link to the lines they came from. */
export const noteLines = pgTable(
  "note_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploadId: uuid("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (table) => [index("note_lines_upload_position_idx").on(table.uploadId, table.position)],
);

export const knowledgePointLines = pgTable(
  "knowledge_point_lines",
  {
    knowledgePointId: uuid("knowledge_point_id")
      .notNull()
      .references(() => knowledgePoints.id, { onDelete: "cascade" }),
    noteLineId: uuid("note_line_id")
      .notNull()
      .references(() => noteLines.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.knowledgePointId, table.noteLineId] }),
    index("knowledge_point_lines_line_idx").on(table.noteLineId),
  ],
);

export const passageLines = pgTable(
  "passage_lines",
  {
    passageId: uuid("passage_id")
      .notNull()
      .references(() => passages.id, { onDelete: "cascade" }),
    noteLineId: uuid("note_line_id")
      .notNull()
      .references(() => noteLines.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.passageId, table.noteLineId] }),
    index("passage_lines_line_idx").on(table.noteLineId),
  ],
);

export type KnowledgePoint = typeof knowledgePoints.$inferSelect;
export type NewKnowledgePoint = typeof knowledgePoints.$inferInsert;
export type Passage = typeof passages.$inferSelect;
export type NewPassage = typeof passages.$inferInsert;
export type NoteLine = typeof noteLines.$inferSelect;
