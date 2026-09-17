import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { ExtractionDiscard, UploadKind } from "@tmr/core";
import { users } from "./users";

export const classrooms = pgTable(
  "classrooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetLanguage: text("target_language").notNull(),
    nativeLanguage: text("native_language").notNull(),
    autoStopDays: integer("auto_stop_days").notNull().default(7),
    activeUntil: timestamp("active_until", { withTimezone: true }).notNull().defaultNow(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    dailyResumedAt: timestamp("daily_resumed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("classrooms_user_idx").on(table.userId)],
);

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    kind: text("kind").$type<UploadKind>().notNull(),
    textContent: text("text_content"),
    storageKey: text("storage_key"),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type"),
    byteSize: integer("byte_size"),
    extractionStatus: text("extraction_status")
      .$type<"pending" | "running" | "done" | "failed">()
      .notNull()
      .default("pending"),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),
    extractionError: text("extraction_error"),
    subject: text("subject"),
    discarded: jsonb("discarded").$type<ExtractionDiscard[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("uploads_classroom_created_idx").on(table.classroomId, table.createdAt)],
);

export type Classroom = typeof classrooms.$inferSelect;
export type NewClassroom = typeof classrooms.$inferInsert;
export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
