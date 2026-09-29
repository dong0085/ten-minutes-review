import { and, desc, eq, ilike, inArray, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import {
  DEFAULT_APP_LIMITS,
  DEFAULT_LLM_PRICES,
  type AppLimits,
  type JobKind,
  type JobStatus,
  type LlmPrices,
} from "@tmr/core";
import type { Db } from "../client";
import {
  adminAuditLog,
  appSettings,
  llmCalls,
  userLimitOverrides,
  type NewLlmCall,
} from "../schema/admin";
import { subscriptions } from "../schema/billing";
import { classrooms, uploads } from "../schema/classrooms";
import { emailPreferences, emailSends } from "../schema/email";
import { jobs } from "../schema/jobs";
import { users } from "../schema/users";

// ---------- Settings ----------

async function readSetting<T extends object>(db: Db, key: string, defaults: T): Promise<T> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return { ...defaults, ...(row?.value as Partial<T> | undefined) };
}

export function getAppLimits(db: Db): Promise<AppLimits> {
  return readSetting(db, "limits", DEFAULT_APP_LIMITS);
}

export function getLlmPrices(db: Db): Promise<LlmPrices> {
  return readSetting(db, "llm_prices", DEFAULT_LLM_PRICES);
}

export async function saveAppSetting(
  db: Db,
  key: "limits" | "llm_prices",
  value: Record<string, unknown>,
  updatedBy: string,
) {
  await db
    .insert(appSettings)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy, updatedAt: new Date() },
    });
}

export type EffectiveLimits = {
  classrooms: number;
  notesUploadsPerMonth: number;
  uploadsPerDay: number;
};

/** Free-tier limits for one user: their override when set, else the global setting. */
export async function getEffectiveLimits(db: Db, userId: string): Promise<EffectiveLimits> {
  const [limits, [override]] = await Promise.all([
    getAppLimits(db),
    db.select().from(userLimitOverrides).where(eq(userLimitOverrides.userId, userId)).limit(1),
  ]);
  return {
    classrooms: override?.classrooms ?? limits.freeClassrooms,
    notesUploadsPerMonth: override?.notesUploadsPerMonth ?? limits.freeNotesUploadsPerMonth,
    uploadsPerDay: limits.uploadsPerUserPerDay,
  };
}

export async function getUserLimitOverride(db: Db, userId: string) {
  const [row] = await db
    .select()
    .from(userLimitOverrides)
    .where(eq(userLimitOverrides.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function setUserLimitOverride(
  db: Db,
  userId: string,
  input: { classrooms: number | null; notesUploadsPerMonth: number | null; note: string | null },
) {
  if (input.classrooms === null && input.notesUploadsPerMonth === null) {
    await db.delete(userLimitOverrides).where(eq(userLimitOverrides.userId, userId));
    return;
  }
  await db
    .insert(userLimitOverrides)
    .values({ userId, ...input })
    .onConflictDoUpdate({
      target: userLimitOverrides.userId,
      set: { ...input, updatedAt: new Date() },
    });
}

// ---------- LLM calls ----------

export async function recordLlmCall(db: Db, call: NewLlmCall) {
  await db.insert(llmCalls).values({ ...call, error: call.error?.slice(0, 2000) ?? null });
}

/** The user a job works for, found through the record its payload points at. */
export async function resolveJobUserId(
  db: Db,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const str = (key: string) => (typeof payload[key] === "string" ? (payload[key] as string) : null);
  const userId = str("userId");
  if (userId) {
    return userId;
  }
  const lookups: [string, SQL][] = [
    ["uploadId", sql`SELECT c.user_id FROM uploads u JOIN classrooms c ON c.id = u.classroom_id WHERE u.id = ${str("uploadId")}`],
    ["classroomId", sql`SELECT user_id FROM classrooms WHERE id = ${str("classroomId")}`],
    ["attemptId", sql`SELECT user_id FROM attempts WHERE id = ${str("attemptId")}`],
    ["requestId", sql`SELECT user_id FROM tutor_requests WHERE id = ${str("requestId")}`],
  ];
  for (const [key, query] of lookups) {
    if (str(key)) {
      const rows = Array.from(await db.execute<{ user_id: string }>(query));
      return rows[0]?.user_id ?? null;
    }
  }
  return null;
}

// ---------- Audit ----------

export async function logAdminAction(
  db: Db,
  entry: {
    adminUserId: string;
    adminEmail: string;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  await db.insert(adminAuditLog).values({
    adminUserId: entry.adminUserId,
    adminEmail: entry.adminEmail,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    detail: entry.detail ?? {},
  });
}

export async function listAdminAudit(
  db: Db,
  filter: { targetType?: string; targetId?: string; action?: string; before?: Date; limit?: number },
) {
  const conditions = [
    filter.targetType ? eq(adminAuditLog.targetType, filter.targetType) : undefined,
    filter.targetId ? eq(adminAuditLog.targetId, filter.targetId) : undefined,
    filter.action ? eq(adminAuditLog.action, filter.action) : undefined,
    filter.before ? lt(adminAuditLog.createdAt, filter.before) : undefined,
  ].filter(Boolean) as SQL[];
  return db
    .select()
    .from(adminAuditLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(filter.limit ?? 50);
}

// ---------- Dashboard ----------

function rowsOf<T>(result: Iterable<unknown>): T[] {
  return Array.from(result) as T[];
}

const PAID = sql`s.status IN ('active', 'trialing') AND (s.current_period_end IS NULL OR s.current_period_end > now())`;

export type AdminOverview = {
  users: { total: number; guests: number; disabled: number; new7d: number; new30d: number };
  active: { d1: number; d7: number; d30: number };
  paid: { stripe: number; comp: number; cancelling: number; new30d: number; churned30d: number };
  content: { classrooms: number; uploads7d: number; quizzes7d: number; attempts7d: number };
  llm: { calls7d: number; failed7d: number; inputTokens30d: number; cachedInputTokens30d: number; outputTokens30d: number };
  alerts: {
    failedJobs24h: number;
    stuckJobs: number;
    pendingJobs: number;
    failedExtractions24h: number;
    lastJobFinishedAt: string | null;
  };
};

export async function getAdminOverview(db: Db): Promise<AdminOverview> {
  const [[u], [a], [p], [c], [l], [al]] = await Promise.all([
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE NOT is_guest)::int AS total,
        count(*) FILTER (WHERE is_guest)::int AS guests,
        count(*) FILTER (WHERE disabled_at IS NOT NULL)::int AS disabled,
        count(*) FILTER (WHERE NOT is_guest AND created_at > now() - interval '7 days')::int AS new7d,
        count(*) FILTER (WHERE NOT is_guest AND created_at > now() - interval '30 days')::int AS new30d
      FROM users`).then(rowsOf),
    db.execute(sql`
      SELECT
        count(DISTINCT user_id) FILTER (WHERE submitted_at > now() - interval '1 day')::int AS d1,
        count(DISTINCT user_id) FILTER (WHERE submitted_at > now() - interval '7 days')::int AS d7,
        count(DISTINCT user_id)::int AS d30
      FROM attempts WHERE submitted_at > now() - interval '30 days'`).then(rowsOf),
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE ${PAID} AND s.plan <> 'comp')::int AS stripe,
        count(*) FILTER (WHERE ${PAID} AND s.plan = 'comp')::int AS comp,
        count(*) FILTER (WHERE ${PAID} AND s.cancel_at_period_end AND s.plan <> 'comp')::int AS cancelling,
        count(*) FILTER (WHERE s.plan <> 'comp' AND s.created_at > now() - interval '30 days')::int AS new30d,
        count(*) FILTER (WHERE s.plan <> 'comp' AND s.status IN ('canceled', 'unpaid', 'incomplete_expired') AND s.updated_at > now() - interval '30 days')::int AS churned30d
      FROM subscriptions s`).then(rowsOf),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM classrooms WHERE archived_at IS NULL)::int AS classrooms,
        (SELECT count(*) FROM uploads WHERE created_at > now() - interval '7 days')::int AS uploads7d,
        (SELECT count(*) FROM quizzes WHERE composed_at > now() - interval '7 days')::int AS quizzes7d,
        (SELECT count(*) FROM attempts WHERE submitted_at > now() - interval '7 days')::int AS attempts7d`).then(rowsOf),
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS calls7d,
        count(*) FILTER (WHERE NOT ok AND created_at > now() - interval '7 days')::int AS failed7d,
        coalesce(sum(input_tokens), 0)::bigint AS "inputTokens30d",
        coalesce(sum(cached_input_tokens), 0)::bigint AS "cachedInputTokens30d",
        coalesce(sum(output_tokens), 0)::bigint AS "outputTokens30d"
      FROM llm_calls WHERE created_at > now() - interval '30 days'`).then(rowsOf),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM jobs WHERE status = 'failed' AND finished_at > now() - interval '1 day')::int AS "failedJobs24h",
        (SELECT count(*) FROM jobs WHERE status = 'running' AND locked_at < now() - interval '10 minutes')::int AS "stuckJobs",
        (SELECT count(*) FROM jobs WHERE status = 'pending' AND run_at <= now())::int AS "pendingJobs",
        (SELECT count(*) FROM uploads WHERE extraction_status = 'failed' AND created_at > now() - interval '1 day')::int AS "failedExtractions24h",
        (SELECT max(finished_at) FROM jobs WHERE status = 'done') AS "lastJobFinishedAt"`).then(rowsOf),
  ]);
  const num = (row: unknown, key: string) => Number((row as Record<string, unknown>)?.[key] ?? 0);
  const alerts = al as Record<string, unknown>;
  return {
    users: { total: num(u, "total"), guests: num(u, "guests"), disabled: num(u, "disabled"), new7d: num(u, "new7d"), new30d: num(u, "new30d") },
    active: { d1: num(a, "d1"), d7: num(a, "d7"), d30: num(a, "d30") },
    paid: { stripe: num(p, "stripe"), comp: num(p, "comp"), cancelling: num(p, "cancelling"), new30d: num(p, "new30d"), churned30d: num(p, "churned30d") },
    content: { classrooms: num(c, "classrooms"), uploads7d: num(c, "uploads7d"), quizzes7d: num(c, "quizzes7d"), attempts7d: num(c, "attempts7d") },
    llm: {
      calls7d: num(l, "calls7d"),
      failed7d: num(l, "failed7d"),
      inputTokens30d: num(l, "inputTokens30d"),
      cachedInputTokens30d: num(l, "cachedInputTokens30d"),
      outputTokens30d: num(l, "outputTokens30d"),
    },
    alerts: {
      failedJobs24h: num(alerts, "failedJobs24h"),
      stuckJobs: num(alerts, "stuckJobs"),
      pendingJobs: num(alerts, "pendingJobs"),
      failedExtractions24h: num(alerts, "failedExtractions24h"),
      lastJobFinishedAt: alerts?.lastJobFinishedAt ? new Date(alerts.lastJobFinishedAt as string).toISOString() : null,
    },
  };
}

export type DailySeriesPoint = {
  day: string;
  signups: number;
  activeUsers: number;
  uploads: number;
  quizzes: number;
  attempts: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

/** One row per UTC day for the last `days` days, oldest first. */
export async function getDailySeries(db: Db, days = 30): Promise<DailySeriesPoint[]> {
  const rows = await db.execute(sql`
    WITH d AS (
      SELECT generate_series((now() AT TIME ZONE 'UTC')::date - (${days - 1})::int, (now() AT TIME ZONE 'UTC')::date, interval '1 day')::date AS day
    )
    SELECT
      to_char(d.day, 'YYYY-MM-DD') AS day,
      (SELECT count(*) FROM users WHERE NOT is_guest AND (created_at AT TIME ZONE 'UTC')::date = d.day)::int AS signups,
      (SELECT count(DISTINCT user_id) FROM attempts WHERE (submitted_at AT TIME ZONE 'UTC')::date = d.day)::int AS "activeUsers",
      (SELECT count(*) FROM uploads WHERE (created_at AT TIME ZONE 'UTC')::date = d.day)::int AS uploads,
      (SELECT count(*) FROM quizzes WHERE (composed_at AT TIME ZONE 'UTC')::date = d.day)::int AS quizzes,
      (SELECT count(*) FROM attempts WHERE (submitted_at AT TIME ZONE 'UTC')::date = d.day)::int AS attempts,
      (SELECT coalesce(sum(input_tokens), 0) FROM llm_calls WHERE (created_at AT TIME ZONE 'UTC')::date = d.day)::bigint AS "inputTokens",
      (SELECT coalesce(sum(cached_input_tokens), 0) FROM llm_calls WHERE (created_at AT TIME ZONE 'UTC')::date = d.day)::bigint AS "cachedInputTokens",
      (SELECT coalesce(sum(output_tokens), 0) FROM llm_calls WHERE (created_at AT TIME ZONE 'UTC')::date = d.day)::bigint AS "outputTokens"
    FROM d ORDER BY d.day`);
  return rowsOf<Record<string, unknown>>(rows).map((row) => ({
    day: String(row.day),
    signups: Number(row.signups),
    activeUsers: Number(row.activeUsers),
    uploads: Number(row.uploads),
    quizzes: Number(row.quizzes),
    attempts: Number(row.attempts),
    inputTokens: Number(row.inputTokens),
    cachedInputTokens: Number(row.cachedInputTokens),
    outputTokens: Number(row.outputTokens),
  }));
}

// ---------- Users ----------

export type AdminUserFilter = "all" | "registered" | "guests" | "paid" | "comp" | "disabled";

export async function listUsersForAdmin(
  db: Db,
  input: { q?: string; filter?: AdminUserFilter; offset?: number; limit?: number },
) {
  const q = input.q?.trim();
  const limit = input.limit ?? 50;
  const conditions: (SQL | undefined)[] = [];
  if (q) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(q);
    conditions.push(isUuid ? eq(users.id, q) : or(ilike(users.email, `%${q}%`), ilike(users.username, `%${q}%`)));
  }
  switch (input.filter) {
    case "registered":
      conditions.push(eq(users.isGuest, false));
      break;
    case "guests":
      conditions.push(eq(users.isGuest, true));
      break;
    case "disabled":
      conditions.push(isNotNull(users.disabledAt));
      break;
    case "paid":
      conditions.push(sql`EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = ${users.id} AND ${PAID} AND s.plan <> 'comp')`);
      break;
    case "comp":
      conditions.push(sql`EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = ${users.id} AND ${PAID} AND s.plan = 'comp')`);
      break;
    default:
      break;
  }
  const where = conditions.filter(Boolean).length ? and(...(conditions.filter(Boolean) as SQL[])) : undefined;
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        isGuest: users.isGuest,
        emailVerifiedAt: users.emailVerifiedAt,
        disabledAt: users.disabledAt,
        createdAt: users.createdAt,
        plan: subscriptions.plan,
        planStatus: subscriptions.status,
        planEnd: subscriptions.currentPeriodEnd,
        classroomCount: sql<number>`(SELECT count(*) FROM classrooms c WHERE c.user_id = ${users.id} AND c.archived_at IS NULL)::int`,
        lastActiveAt: sql<Date | null>`(SELECT max(submitted_at) FROM attempts a WHERE a.user_id = ${users.id})`,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(input.offset ?? 0),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return { rows, total: Number(count?.n ?? 0) };
}

export async function getUserAdminDetail(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return null;
  }
  const [
    accountRows,
    [subscription],
    [preferences],
    classroomRows,
    tokenRows,
    [usage],
    [llm],
    referralRows,
    [referredBy],
    [override],
  ] = await Promise.all([
    db.execute(sql`SELECT provider, provider_account_id AS "providerAccountId" FROM accounts WHERE user_id = ${userId}`).then(rowsOf<{ provider: string; providerAccountId: string }>),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1),
    db.select().from(emailPreferences).where(eq(emailPreferences.userId, userId)).limit(1),
    db.execute(sql`
      SELECT c.id, c.name, c.target_language AS "targetLanguage", c.native_language AS "nativeLanguage",
        c.active_until AS "activeUntil", c.paused_at AS "pausedAt", c.archived_at AS "archivedAt", c.created_at AS "createdAt",
        (SELECT count(*) FROM knowledge_points kp WHERE kp.classroom_id = c.id AND kp.retired_at IS NULL)::int AS "bankSize",
        (SELECT count(*) FROM uploads up WHERE up.classroom_id = c.id)::int AS "uploadCount",
        (SELECT count(*) FROM quizzes q WHERE q.classroom_id = c.id)::int AS "quizCount"
      FROM classrooms c WHERE c.user_id = ${userId} ORDER BY c.created_at DESC`).then(rowsOf),
    db.execute(sql`
      SELECT id, name, prefix, created_at AS "createdAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"
      FROM api_tokens WHERE user_id = ${userId} ORDER BY created_at DESC`).then(rowsOf),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM uploads up JOIN classrooms c ON c.id = up.classroom_id WHERE c.user_id = ${userId} AND up.created_at >= date_trunc('month', now()))::int AS "uploadsThisMonth",
        (SELECT count(*) FROM uploads up JOIN classrooms c ON c.id = up.classroom_id WHERE c.user_id = ${userId})::int AS "uploadsTotal",
        (SELECT count(*) FROM attempts WHERE user_id = ${userId})::int AS "attemptsTotal",
        (SELECT count(*) FROM attempts WHERE user_id = ${userId} AND submitted_at > now() - interval '30 days')::int AS "attempts30d",
        (SELECT max(submitted_at) FROM attempts WHERE user_id = ${userId}) AS "lastActiveAt",
        (SELECT count(*) FROM email_sends WHERE user_id = ${userId})::int AS "emailsSent",
        (SELECT count(*) FROM tutor_requests WHERE user_id = ${userId})::int AS "tutorRequests"`).then(rowsOf<Record<string, unknown>>),
    db.execute(sql`
      SELECT count(*)::int AS calls, count(*) FILTER (WHERE NOT ok)::int AS failed,
        coalesce(sum(input_tokens), 0)::bigint AS "inputTokens",
        coalesce(sum(cached_input_tokens), 0)::bigint AS "cachedInputTokens",
        coalesce(sum(output_tokens), 0)::bigint AS "outputTokens"
      FROM llm_calls WHERE user_id = ${userId}`).then(rowsOf<Record<string, unknown>>),
    db.execute(sql`
      SELECT r.id, r.status, r.created_at AS "createdAt", r.rewarded_at AS "rewardedAt", u.id AS "userId", u.email
      FROM referrals r JOIN users u ON u.id = r.referred_user_id
      WHERE r.referrer_user_id = ${userId} ORDER BY r.created_at DESC`).then(rowsOf),
    db.execute(sql`
      SELECT u.id AS "userId", u.email, r.status FROM referrals r JOIN users u ON u.id = r.referrer_user_id
      WHERE r.referred_user_id = ${userId} LIMIT 1`).then(rowsOf),
    db.select().from(userLimitOverrides).where(eq(userLimitOverrides.userId, userId)).limit(1),
  ]);
  const { passwordHash, ...safeUser } = user;
  return {
    user: { ...safeUser, hasPassword: Boolean(passwordHash) },
    accounts: accountRows,
    subscription: subscription ?? null,
    emailPreferences: preferences ?? null,
    classrooms: classroomRows,
    apiTokens: tokenRows,
    usage: Object.fromEntries(Object.entries(usage ?? {}).map(([k, v]) => [k, k === "lastActiveAt" ? v : Number(v ?? 0)])),
    llm: Object.fromEntries(Object.entries(llm ?? {}).map(([k, v]) => [k, Number(v ?? 0)])),
    referrals: referralRows,
    referredBy: referredBy ?? null,
    limitOverride: override ?? null,
  };
}

export async function listEmailSendsForUser(db: Db, userId: string, limit = 50) {
  return db
    .select()
    .from(emailSends)
    .where(eq(emailSends.userId, userId))
    .orderBy(desc(emailSends.createdAt))
    .limit(limit);
}

export async function setUserDisabled(db: Db, userId: string, reason: string | null) {
  await db
    .update(users)
    .set({
      disabledAt: reason === null ? null : new Date(),
      disabledReason: reason,
      updatedAt: new Date(),
      ...(reason === null ? {} : { sessionVersion: sql`${users.sessionVersion} + 1` }),
    })
    .where(eq(users.id, userId));
}

/** Gives complimentary Pro until `until`, unless a live Stripe subscription already covers the user. */
export async function grantCompPlan(db: Db, userId: string, until: Date) {
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (existing && existing.plan !== "comp" && existing.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(existing.status)) {
    throw new Error("User already has a Stripe subscription");
  }
  await db
    .insert(subscriptions)
    .values({ userId, plan: "comp", status: "active", currentPeriodEnd: until, cancelAtPeriodEnd: true })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        plan: "comp",
        status: "active",
        currentPeriodEnd: until,
        cancelAtPeriodEnd: true,
        stripeSubscriptionId: null,
        updatedAt: new Date(),
      },
    });
}

export async function endCompPlan(db: Db, userId: string) {
  await db
    .update(subscriptions)
    .set({ status: "canceled", currentPeriodEnd: new Date(), updatedAt: new Date() })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.plan, "comp")));
}

// ---------- Content (read-only views of a learner's data) ----------

export async function getClassroomAdminDetail(db: Db, classroomId: string) {
  const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId)).limit(1);
  if (!classroom) {
    return null;
  }
  const [uploadRows, pointRows, quizRows, attemptRows, tutorRows] = await Promise.all([
    db
      .select({
        id: uploads.id,
        kind: uploads.kind,
        originalFilename: uploads.originalFilename,
        subject: uploads.subject,
        extractionStatus: uploads.extractionStatus,
        extractionError: uploads.extractionError,
        createdAt: uploads.createdAt,
        pointCount: sql<number>`(SELECT count(*) FROM knowledge_points kp WHERE kp.source_upload_id = ${uploads.id})::int`,
      })
      .from(uploads)
      .where(eq(uploads.classroomId, classroomId))
      .orderBy(desc(uploads.createdAt)),
    db.execute(sql`
      SELECT id, category, target_text AS "targetText", native_text AS "nativeText", retired_at AS "retiredAt", created_at AS "createdAt"
      FROM knowledge_points WHERE classroom_id = ${classroomId} ORDER BY created_at DESC LIMIT 500`).then(rowsOf),
    db.execute(sql`
      SELECT q.id, q.quiz_date AS "quizDate", q.kind, q.size, q.prompt_version AS "promptVersion", q.composed_at AS "composedAt",
        (SELECT count(*) FROM attempts a WHERE a.quiz_id = q.id)::int AS "attemptCount"
      FROM quizzes q WHERE q.classroom_id = ${classroomId} ORDER BY q.composed_at DESC LIMIT 200`).then(rowsOf),
    db.execute(sql`
      SELECT a.id, a.quiz_id AS "quizId", a.correct_count AS "correctCount", a.question_count AS "questionCount",
        a.duration_ms AS "durationMs", a.submitted_at AS "submittedAt"
      FROM attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE q.classroom_id = ${classroomId}
      ORDER BY a.submitted_at DESC LIMIT 200`).then(rowsOf),
    db.execute(sql`
      SELECT id, mode, level, status, prompt_version AS "promptVersion", created_at AS "createdAt"
      FROM tutor_requests WHERE classroom_id = ${classroomId} ORDER BY created_at DESC LIMIT 100`).then(rowsOf),
  ]);
  return { classroom, uploads: uploadRows, knowledgePoints: pointRows, quizzes: quizRows, attempts: attemptRows, tutorRequests: tutorRows };
}

export async function getQuizAdminDetail(db: Db, quizId: string) {
  const [quiz] = Array.from(await db.execute(sql`
    SELECT q.*, c.name AS "classroomName" FROM quizzes q JOIN classrooms c ON c.id = q.classroom_id WHERE q.id = ${quizId}`)) as Record<string, unknown>[];
  if (!quiz) {
    return null;
  }
  const questionRows = await db.execute(sql`
    SELECT id, position, category, type, stem, options, answer, explanation
    FROM questions WHERE quiz_id = ${quizId} ORDER BY position`).then(rowsOf);
  return { quiz, questions: questionRows };
}

// ---------- Uploads ----------

export async function listUploadsForAdmin(
  db: Db,
  input: { status?: string; offset?: number; limit?: number },
) {
  const where = input.status ? sql`WHERE up.extraction_status = ${input.status}` : sql``;
  const rows = await db.execute(sql`
    SELECT up.id, up.kind, up.original_filename AS "originalFilename", up.subject, up.byte_size AS "byteSize",
      up.extraction_status AS "extractionStatus", up.extraction_error AS "extractionError", up.created_at AS "createdAt",
      c.id AS "classroomId", c.name AS "classroomName", u.id AS "userId", u.email,
      (SELECT count(*) FROM knowledge_points kp WHERE kp.source_upload_id = up.id)::int AS "pointCount"
    FROM uploads up JOIN classrooms c ON c.id = up.classroom_id JOIN users u ON u.id = c.user_id
    ${where}
    ORDER BY up.created_at DESC LIMIT ${input.limit ?? 50} OFFSET ${input.offset ?? 0}`);
  return rowsOf(rows);
}

export async function getUploadAdminDetail(db: Db, uploadId: string) {
  const [row] = Array.from(await db.execute(sql`
    SELECT up.*, c.name AS "classroomName", c.target_language AS "targetLanguage", c.native_language AS "nativeLanguage",
      u.id AS "userId", u.email
    FROM uploads up JOIN classrooms c ON c.id = up.classroom_id JOIN users u ON u.id = c.user_id
    WHERE up.id = ${uploadId}`)) as Record<string, unknown>[];
  if (!row) {
    return null;
  }
  const [points, passageRows, jobRows] = await Promise.all([
    db.execute(sql`
      SELECT id, category, target_text AS "targetText", native_text AS "nativeText", inferred, note, detail,
        source_excerpt AS "sourceExcerpt", prompt_version AS "promptVersion", retired_at AS "retiredAt"
      FROM knowledge_points WHERE source_upload_id = ${uploadId} ORDER BY created_at`).then(rowsOf),
    db.execute(sql`
      SELECT id, target_text AS "targetText", native_text AS "nativeText" FROM passages WHERE source_upload_id = ${uploadId}`).then(rowsOf),
    db.execute(sql`
      SELECT id, status, attempts, last_error AS "lastError", created_at AS "createdAt", finished_at AS "finishedAt"
      FROM jobs WHERE kind = 'extract' AND payload->>'uploadId' = ${uploadId} ORDER BY created_at DESC`).then(rowsOf),
  ]);
  return { upload: row, knowledgePoints: points, passages: passageRows, jobs: jobRows };
}

// ---------- Jobs ----------

export async function listJobsForAdmin(
  db: Db,
  input: { kind?: JobKind; status?: JobStatus | "stuck"; offset?: number; limit?: number },
) {
  const conditions: SQL[] = [];
  if (input.kind) {
    conditions.push(eq(jobs.kind, input.kind));
  }
  if (input.status === "stuck") {
    conditions.push(eq(jobs.status, "running"), sql`${jobs.lockedAt} < now() - interval '10 minutes'`);
  } else if (input.status) {
    conditions.push(eq(jobs.status, input.status));
  }
  return db
    .select()
    .from(jobs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(jobs.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
}

export async function getJobCounts(db: Db) {
  const rows = await db.execute(sql`
    SELECT kind, status, count(*)::int AS n FROM jobs
    WHERE created_at > now() - interval '7 days' OR status IN ('pending', 'running')
    GROUP BY kind, status`);
  return rowsOf<{ kind: JobKind; status: JobStatus; n: number }>(rows);
}

export async function listLlmCallsForJob(db: Db, jobId: string) {
  return db.select().from(llmCalls).where(eq(llmCalls.jobId, jobId)).orderBy(llmCalls.createdAt);
}

/** Puts a failed or cancelled job back in the queue with a fresh attempt budget. */
export async function retryJob(db: Db, jobId: string) {
  const [row] = await db
    .update(jobs)
    .set({ status: "pending", attempts: 0, runAt: new Date(), lockedAt: null, lockedBy: null, finishedAt: null })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ["failed", "cancelled", "done"])))
    .returning();
  return row ?? null;
}

export async function cancelPendingJob(db: Db, jobId: string) {
  const [row] = await db
    .update(jobs)
    .set({ status: "cancelled", finishedAt: new Date(), lockedAt: null, lockedBy: null })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "pending")))
    .returning();
  return row ?? null;
}

// ---------- LLM usage ----------

export async function getLlmUsage(db: Db, days = 30) {
  const since = sql`now() - (${days}::int * interval '1 day')`;
  const [byDay, byPurpose, byModel, topUsers, recentErrors] = await Promise.all([
    db.execute(sql`
      SELECT to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, purpose,
        count(*)::int AS calls, count(*) FILTER (WHERE NOT ok)::int AS failed,
        sum(input_tokens)::bigint AS "inputTokens", sum(cached_input_tokens)::bigint AS "cachedInputTokens",
        sum(output_tokens)::bigint AS "outputTokens"
      FROM llm_calls WHERE created_at > ${since} GROUP BY 1, 2 ORDER BY 1`).then(rowsOf<Record<string, unknown>>),
    db.execute(sql`
      SELECT purpose, count(*)::int AS calls, count(*) FILTER (WHERE NOT ok)::int AS failed,
        sum(input_tokens)::bigint AS "inputTokens", sum(cached_input_tokens)::bigint AS "cachedInputTokens",
        sum(output_tokens)::bigint AS "outputTokens",
        percentile_disc(0.5) WITHIN GROUP (ORDER BY duration_ms)::int AS "p50Ms",
        percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS "p95Ms"
      FROM llm_calls WHERE created_at > ${since} GROUP BY purpose ORDER BY purpose`).then(rowsOf<Record<string, unknown>>),
    db.execute(sql`
      SELECT provider, model, count(*)::int AS calls FROM llm_calls WHERE created_at > ${since}
      GROUP BY provider, model ORDER BY calls DESC`).then(rowsOf<Record<string, unknown>>),
    db.execute(sql`
      SELECT l.user_id AS "userId", u.email, count(*)::int AS calls,
        sum(l.input_tokens)::bigint AS "inputTokens", sum(l.cached_input_tokens)::bigint AS "cachedInputTokens",
        sum(l.output_tokens)::bigint AS "outputTokens",
        bool_or(${PAID}) AS paid
      FROM llm_calls l LEFT JOIN users u ON u.id = l.user_id LEFT JOIN subscriptions s ON s.user_id = l.user_id
      WHERE l.created_at > ${since}
      GROUP BY l.user_id, u.email
      ORDER BY sum(l.input_tokens) + 4 * sum(l.output_tokens) DESC LIMIT 20`).then(rowsOf<Record<string, unknown>>),
    db.execute(sql`
      SELECT id, purpose, model, user_id AS "userId", job_id AS "jobId", error, duration_ms AS "durationMs", created_at AS "createdAt"
      FROM llm_calls WHERE NOT ok ORDER BY created_at DESC LIMIT 30`).then(rowsOf<Record<string, unknown>>),
  ]);
  const numeric = (row: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v]));
  return {
    byDay: byDay.map(numeric),
    byPurpose: byPurpose.map(numeric),
    byModel: byModel.map(numeric),
    topUsers: topUsers.map(numeric),
    recentErrors,
  };
}

// ---------- Billing ----------

export async function listSubscriptionsForAdmin(db: Db, input: { status?: "live" | "comp" | "ended" }) {
  const where =
    input.status === "live"
      ? sql`WHERE ${PAID} AND s.plan <> 'comp'`
      : input.status === "comp"
        ? sql`WHERE s.plan = 'comp'`
        : input.status === "ended"
          ? sql`WHERE NOT (${PAID})`
          : sql``;
  const rows = await db.execute(sql`
    SELECT s.*, u.email FROM subscriptions s JOIN users u ON u.id = s.user_id
    ${where} ORDER BY s.updated_at DESC LIMIT 500`);
  return rowsOf<Record<string, unknown>>(rows);
}

// ---------- Emails ----------

export async function getEmailStats(db: Db, days = 30) {
  const [byDay, recent, [prefs]] = await Promise.all([
    db.execute(sql`
      SELECT sent_on AS day, kind, count(*)::int AS n FROM email_sends
      WHERE sent_on > (now() - (${days}::int * interval '1 day'))::date GROUP BY 1, 2 ORDER BY 1`).then(rowsOf<Record<string, unknown>>),
    db.execute(sql`
      SELECT e.id, e.sent_on AS "sentOn", e.kind, e.provider_message_id AS "providerMessageId", e.created_at AS "createdAt",
        u.id AS "userId", u.email
      FROM email_sends e JOIN users u ON u.id = e.user_id ORDER BY e.created_at DESC LIMIT 100`).then(rowsOf<Record<string, unknown>>),
    db.execute(sql`
      SELECT count(*) FILTER (WHERE daily_enabled AND unsubscribed_at IS NULL)::int AS subscribed,
        count(*) FILTER (WHERE NOT daily_enabled)::int AS "dailyOff",
        count(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed,
        count(*) FILTER (WHERE unsubscribed_at > now() - interval '30 days')::int AS "unsubscribed30d"
      FROM email_preferences`).then(rowsOf<Record<string, unknown>>),
  ]);
  return { byDay, recent, preferences: prefs ?? {} };
}

// ---------- Referrals ----------

export async function listReferralsForAdmin(db: Db) {
  const rows = await db.execute(sql`
    SELECT r.id, r.status, r.code, r.source_code AS "sourceCode", r.reward_months AS "rewardMonths",
      r.created_at AS "createdAt", r.rewarded_at AS "rewardedAt",
      ru.id AS "referrerId", ru.email AS "referrerEmail",
      nu.id AS "referredId", nu.email AS "referredEmail"
    FROM referrals r
    JOIN users ru ON ru.id = r.referrer_user_id
    LEFT JOIN users nu ON nu.id = r.referred_user_id
    WHERE r.referred_user_id IS NOT NULL
    ORDER BY r.created_at DESC LIMIT 500`);
  const [totals] = Array.from(await db.execute(sql`
    SELECT count(*) FILTER (WHERE referred_user_id IS NOT NULL)::int AS signups,
      count(*) FILTER (WHERE status = 'rewarded')::int AS rewarded,
      count(DISTINCT referrer_user_id) FILTER (WHERE referred_user_id IS NOT NULL)::int AS referrers
    FROM referrals`)) as Record<string, unknown>[];
  return { rows: rowsOf<Record<string, unknown>>(rows), totals: totals ?? {} };
}
