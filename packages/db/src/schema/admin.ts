import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { LlmPurpose } from "@tmr/core";
import { users } from "./users";

/** Runtime settings the admin console edits, keyed by name (`limits`, `llm_prices`). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

/** Per-user free-tier limits. A null field falls back to the global setting. */
export const userLimitOverrides = pgTable("user_limit_overrides", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  classrooms: integer("classrooms"),
  notesUploadsPerMonth: integer("notes_uploads_per_month"),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per LLM request, for cost and failure tracking. */
export const llmCalls = pgTable(
  "llm_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purpose: text("purpose").$type<LlmPurpose>().notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    jobId: uuid("job_id"),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    ok: boolean("ok").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("llm_calls_created_idx").on(table.createdAt),
    index("llm_calls_user_idx").on(table.userId, table.createdAt),
    index("llm_calls_job_idx").on(table.jobId),
  ],
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id").references(() => users.id, { onDelete: "set null" }),
    adminEmail: text("admin_email").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_audit_created_idx").on(table.createdAt),
    index("admin_audit_target_idx").on(table.targetType, table.targetId),
  ],
);

export type AppSetting = typeof appSettings.$inferSelect;
export type UserLimitOverride = typeof userLimitOverrides.$inferSelect;
export type LlmCall = typeof llmCalls.$inferSelect;
export type NewLlmCall = typeof llmCalls.$inferInsert;
export type AdminAuditEntry = typeof adminAuditLog.$inferSelect;
