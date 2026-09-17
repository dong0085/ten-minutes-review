import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pg-proxy";
import { describe, expect, it, vi } from "vitest";
import {
  listDailyEmailQuizzesForUserOnDate,
  listDueClassrooms,
  listReadyDailyEmailRecipients,
  listUnsentDailyEmailRecipients,
} from "@tmr/db";
import type { Db } from "@tmr/db";
import { runWorkerOnce, WorkerRunError } from "./runner";
import { auditOverdueDailyEmails } from "./scheduler";

describe("daily scheduler database query", () => {
  it("encodes JavaScript dates before passing them to postgres-js", async () => {
    const sendAt = new Date("2026-09-15T11:00:00.000Z");
    const execute = vi.fn(async (query) => {
      const compiled = new PgDialect().sqlToQuery(query);
      expect(compiled.params).toEqual([sendAt.toISOString(), sendAt.toISOString()]);
      return [];
    });

    await listDueClassrooms({ execute } as unknown as Db, sendAt);
    expect(execute).toHaveBeenCalledOnce();
  });

  it.each([
    ["due classrooms", listDueClassrooms],
    ["ready email recipients", listReadyDailyEmailRecipients],
    ["unsent email recipients", listUnsentDailyEmailRecipients],
  ])("excludes paused and same-cutoff resumed classrooms from %s", async (_label, queryFn) => {
    const sendAt = new Date("2026-09-15T11:00:00.000Z");
    const execute = vi.fn(async (query) => {
      const compiled = new PgDialect().sqlToQuery(query);
      const normalized = compiled.sql.replace(/\s+/g, " ").toLowerCase();
      expect(normalized).toContain("c.paused_at is null");
      expect(normalized).toContain(
        "coalesce(c.daily_resumed_at, c.created_at) < $2",
      );
      expect(compiled.params).toEqual([sendAt.toISOString(), sendAt.toISOString()]);
      return [];
    });

    await queryFn({ execute } as unknown as Db, sendAt);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("filters queued daily email contents by pause and resume cutoff", async () => {
    let capturedSql = "";
    const proxy = drizzle(async (query) => {
      capturedSql = query;
      return { rows: [] };
    });

    await listDailyEmailQuizzesForUserOnDate(
      proxy as unknown as Db,
      "00000000-0000-0000-0000-000000000001",
      "2026-09-15",
      new Date("2026-09-15T11:00:00.000Z"),
    );

    const normalized = capturedSql.replace(/\s+/g, " ").toLowerCase();
    expect(normalized).toContain('"classrooms"."paused_at" is null');
    expect(normalized).toContain(
      'coalesce("classrooms"."daily_resumed_at", "classrooms"."created_at") < $4',
    );
  });

  it("does not audit delivery before the 30-minute grace period", async () => {
    const execute = vi.fn();
    const overdue = await auditOverdueDailyEmails(
      { execute } as unknown as Db,
      new Date("2026-09-15T11:29:59.000Z"),
    );
    expect(overdue).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("one-shot worker", () => {
  it("composes before deciding which consolidated emails are ready", async () => {
    const calls: string[] = [];
    let drain = 0;
    const summary = await runWorkerOnce({} as Db, new Date("2026-09-15T11:10:00.000Z"), {
      reapStaleJobs: vi.fn(async () => {
        calls.push("reap");
        return { retried: 0, failed: 0 };
      }),
      enqueueDueDailyComposeJobs: vi.fn(async () => {
        calls.push("compose");
        return 2;
      }),
      drainJobs: vi.fn(async () => {
        calls.push(`drain-${++drain}`);
        return { processed: 2, failedAttempts: 0, terminalFailures: 0 };
      }),
      enqueueReadyDailyEmailJobs: vi.fn(async () => {
        calls.push("email");
        return 1;
      }),
      auditOverdueDailyEmails: vi.fn(async () => {
        calls.push("audit");
        return [];
      }),
    });

    expect(calls).toEqual(["reap", "compose", "drain-1", "email", "drain-2", "audit"]);
    expect(summary).toMatchObject({
      composeJobsEnqueued: 2,
      emailJobsEnqueued: 1,
      jobsProcessed: 4,
      terminalFailures: 0,
      overdueDeliveries: 0,
    });
  });

  it("fails the cron run when a job is terminal or delivery is overdue", async () => {
    const execution = runWorkerOnce({} as Db, new Date("2026-09-15T11:40:00.000Z"), {
      reapStaleJobs: vi.fn(async () => ({ retried: 0, failed: 0 })),
      enqueueDueDailyComposeJobs: vi.fn(async () => 0),
      drainJobs: vi.fn(async () => ({
        processed: 1,
        failedAttempts: 1,
        terminalFailures: 1,
      })),
      enqueueReadyDailyEmailJobs: vi.fn(async () => 0),
      auditOverdueDailyEmails: vi.fn(async () => [
        {
          userId: "user-1",
          localDate: "2026-09-15",
          missingClassrooms: 1,
          quizCount: 0,
        },
      ]),
    });

    await expect(execution).rejects.toBeInstanceOf(WorkerRunError);
    await expect(execution).rejects.toMatchObject({
      summary: { terminalFailures: 2, overdueDeliveries: 1 },
    });
  });
});
