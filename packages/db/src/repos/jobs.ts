import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { JOB_MAX_ATTEMPTS, JOB_STALE_MINUTES } from "@tmr/core";
import type { JobKind } from "@tmr/core";
import type { Db } from "../client";
import { jobs } from "../schema/jobs";
import type { Job } from "../schema/jobs";

export async function enqueueJob(
  db: Db,
  input: { kind: JobKind; payload?: Record<string, unknown>; runAt?: Date },
) {
  const [job] = await db
    .insert(jobs)
    .values({
      kind: input.kind,
      payload: input.payload ?? {},
      runAt: input.runAt ?? new Date(),
    })
    .returning();
  return job;
}

export async function claimJob(db: Db, workerId: string) {
  const result = await db.execute(sql`
    UPDATE jobs
    SET status = 'running',
        locked_at = now(),
        locked_by = ${workerId},
        attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending' AND run_at <= now()
      ORDER BY run_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);
  const rows = Array.from(result) as unknown as Job[];
  return rows[0] ?? null;
}

export async function claimSpecificJob(db: Db, jobId: string, workerId: string) {
  const result = await db.execute(sql`
    UPDATE jobs
    SET status = 'running',
        locked_at = now(),
        locked_by = ${workerId},
        attempts = attempts + 1
    WHERE id = ${jobId} AND status = 'pending' AND run_at <= now()
    RETURNING *
  `);
  const rows = Array.from(result) as unknown as Job[];
  return rows[0] ?? null;
}

export async function completeJob(db: Db, jobId: string) {
  await db
    .update(jobs)
    .set({ status: "done", finishedAt: new Date(), lockedAt: null, lockedBy: null })
    .where(eq(jobs.id, jobId));
}

export async function failJob(db: Db, jobId: string, error: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) {
    return { terminal: false };
  }
  const terminal = job.attempts >= JOB_MAX_ATTEMPTS;
  await db
    .update(jobs)
    .set({
      status: terminal ? "failed" : "pending",
      lastError: error.slice(0, 2000),
      lockedAt: null,
      lockedBy: null,
      finishedAt: terminal ? new Date() : null,
      runAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
  return { terminal };
}

export async function reapStaleJobs(db: Db) {
  const retried = await db.execute(sql`
    UPDATE jobs
    SET status = 'pending',
        locked_at = NULL,
        locked_by = NULL
    WHERE status = 'running'
      AND locked_at < now() - (${JOB_STALE_MINUTES} * interval '1 minute')
      AND attempts < ${JOB_MAX_ATTEMPTS}
    RETURNING id
  `);
  const failed = await db.execute(sql`
    UPDATE jobs
    SET status = 'failed',
        last_error = COALESCE(last_error, 'stalled'),
        finished_at = now(),
        locked_at = NULL,
        locked_by = NULL
    WHERE status = 'running'
      AND locked_at < now() - (${JOB_STALE_MINUTES} * interval '1 minute')
      AND attempts >= ${JOB_MAX_ATTEMPTS}
    RETURNING id
  `);
  return { retried: Array.from(retried).length, failed: Array.from(failed).length };
}

/** Merges what a job produced into its payload, so a client polling the job can find it. */
export async function recordJobResult(db: Db, jobId: string, result: Record<string, unknown>) {
  await db
    .update(jobs)
    .set({ payload: sql`${jobs.payload} || ${JSON.stringify(result)}::jsonb` })
    .where(eq(jobs.id, jobId));
}

export async function getJobById(db: Db, jobId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return job ?? null;
}

export async function hasPendingComposeJob(db: Db, classroomId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.kind, "compose"),
        inArray(jobs.status, ["pending", "running"]),
        sql`${jobs.payload}->>'classroomId' = ${classroomId}`,
        sql`${jobs.payload}->>'cancelRequested' IS DISTINCT FROM 'true'`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function hasActiveDailyComposeJob(
  db: Db,
  classroomId: string,
  localDate: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.kind, "compose"),
        inArray(jobs.status, ["pending", "running"]),
        sql`${jobs.payload}->>'classroomId' = ${classroomId}`,
        sql`${jobs.payload}->>'localDate' = ${localDate}`,
        sql`COALESCE(${jobs.payload}->>'source', 'daily') = 'daily'`,
        sql`${jobs.payload}->>'cancelRequested' IS DISTINCT FROM 'true'`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function hasActiveDailyEmailJob(
  db: Db,
  userId: string,
  localDate: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.kind, "send_email"),
        inArray(jobs.status, ["pending", "running"]),
        sql`${jobs.payload}->>'userId' = ${userId}`,
        sql`${jobs.payload}->>'quizDate' = ${localDate}`,
        sql`COALESCE(${jobs.payload}->>'kind', 'daily') = 'daily'`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function getActiveComposeJob(db: Db, classroomId: string) {
  const [job] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.kind, "compose"),
        inArray(jobs.status, ["pending", "running"]),
        sql`${jobs.payload}->>'classroomId' = ${classroomId}`,
        sql`${jobs.payload}->>'cancelRequested' IS DISTINCT FROM 'true'`,
      ),
    )
    .orderBy(sql`${jobs.createdAt} desc`)
    .limit(1);
  return job ?? null;
}

export async function getLatestComposeJob(db: Db, classroomId: string, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const [job] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.kind, "compose"),
        inArray(jobs.status, ["pending", "running"]),
        sql`${jobs.payload}->>'classroomId' = ${classroomId}`,
        sql`${jobs.payload}->>'cancelRequested' IS DISTINCT FROM 'true'`,
        gte(jobs.createdAt, since),
      ),
    )
    .orderBy(sql`${jobs.createdAt} desc`)
    .limit(1);
  return job ?? null;
}

export async function markJobCancelled(db: Db, jobId: string) {
  await db
    .update(jobs)
    .set({
      status: "cancelled",
      lastError: "cancelled",
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(jobs.id, jobId));
}

export async function requestJobCancel(db: Db, jobId: string) {
  await db
    .update(jobs)
    .set({
      payload: sql`${jobs.payload} || '{"cancelRequested": true}'::jsonb`,
    })
    .where(eq(jobs.id, jobId));
}
