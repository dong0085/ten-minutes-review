import os from "node:os";
import { claimJob, cleanupExpiredGuests, completeJob, failJob, reapStaleJobs } from "@tmr/db";
import type { Db, Job } from "@tmr/db";
import { handleComposeJob } from "./handlers/compose";
import { handleExtractJob } from "./handlers/extract";
import { handleSendEmailJob } from "./handlers/send-email";
import { handleSummarizeJob } from "./handlers/summarize";
import {
  auditOverdueDailyEmails,
  enqueueDueDailyComposeJobs,
  enqueueReadyDailyEmailJobs,
} from "./scheduler";

const workerId = `${os.hostname()}:${process.pid}`;

export type DrainResult = {
  processed: number;
  failedAttempts: number;
  terminalFailures: number;
};

export type WorkerRunSummary = {
  staleJobsRetried: number;
  staleJobsFailed: number;
  composeJobsEnqueued: number;
  emailJobsEnqueued: number;
  jobsProcessed: number;
  failedAttempts: number;
  terminalFailures: number;
  overdueDeliveries: number;
};

export class WorkerRunError extends Error {
  constructor(public readonly summary: WorkerRunSummary) {
    super(
      `worker run failed: ${summary.terminalFailures} terminal job failure(s), ${summary.overdueDeliveries} overdue daily delivery(ies)`,
    );
    this.name = "WorkerRunError";
  }
}

export async function runJob(db: Db, job: Job): Promise<void> {
  switch (job.kind) {
    case "extract":
      return handleExtractJob(db, job.payload);
    case "compose":
      return handleComposeJob(db, job.payload, job.id);
    case "send_email":
      return handleSendEmailJob(db, job.payload);
    case "summarize":
      return handleSummarizeJob(db, job.payload);
    default:
      throw new Error(`unknown job kind: ${String(job.kind)}`);
  }
}

export async function processNextJob(
  db: Db,
): Promise<{ failed: boolean; terminal: boolean } | null> {
  const job = await claimJob(db, workerId);
  if (!job) {
    return null;
  }
  try {
    await runJob(db, job);
    await completeJob(db, job.id);
    console.log(`[worker] ${job.kind} ${job.id} done`);
    return { failed: false, terminal: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = await failJob(db, job.id, message);
    console.error(`[worker] ${job.kind} ${job.id} failed: ${message}`);
    return { failed: true, terminal: result.terminal };
  }
}

export async function drainJobs(db: Db): Promise<DrainResult> {
  const result: DrainResult = { processed: 0, failedAttempts: 0, terminalFailures: 0 };
  while (true) {
    const processed = await processNextJob(db);
    if (!processed) {
      return result;
    }
    result.processed += 1;
    if (processed.failed) {
      result.failedAttempts += 1;
    }
    if (processed.terminal) {
      result.terminalFailures += 1;
    }
  }
}

export type WorkerRunDependencies = {
  reapStaleJobs: typeof reapStaleJobs;
  cleanupExpiredGuests?: typeof cleanupExpiredGuests;
  enqueueDueDailyComposeJobs: typeof enqueueDueDailyComposeJobs;
  enqueueReadyDailyEmailJobs: typeof enqueueReadyDailyEmailJobs;
  auditOverdueDailyEmails: typeof auditOverdueDailyEmails;
  drainJobs: typeof drainJobs;
};

const defaultDependencies: WorkerRunDependencies = {
  reapStaleJobs,
  cleanupExpiredGuests,
  enqueueDueDailyComposeJobs,
  enqueueReadyDailyEmailJobs,
  auditOverdueDailyEmails,
  drainJobs,
};

export async function runWorkerOnce(
  db: Db,
  now: Date = new Date(),
  dependencies: WorkerRunDependencies = defaultDependencies,
): Promise<WorkerRunSummary> {
  const stale = await dependencies.reapStaleJobs(db);
  if (dependencies.cleanupExpiredGuests) {
    await dependencies.cleanupExpiredGuests(db).catch((err) =>
      console.error("[worker] cleanup expired guests error", err),
    );
  }
  const composeJobsEnqueued = await dependencies.enqueueDueDailyComposeJobs(db, now);
  const composeDrain = await dependencies.drainJobs(db);
  const emailJobsEnqueued = await dependencies.enqueueReadyDailyEmailJobs(db, now);
  const emailDrain = await dependencies.drainJobs(db);
  const overdue = await dependencies.auditOverdueDailyEmails(db, now);

  for (const delivery of overdue) {
    console.error(
      `[worker] overdue daily delivery user=${delivery.userId} date=${delivery.localDate} missingClassrooms=${delivery.missingClassrooms} quizCount=${delivery.quizCount}`,
    );
  }

  const summary: WorkerRunSummary = {
    staleJobsRetried: stale.retried,
    staleJobsFailed: stale.failed,
    composeJobsEnqueued,
    emailJobsEnqueued,
    jobsProcessed: composeDrain.processed + emailDrain.processed,
    failedAttempts: composeDrain.failedAttempts + emailDrain.failedAttempts,
    terminalFailures:
      stale.failed + composeDrain.terminalFailures + emailDrain.terminalFailures,
    overdueDeliveries: overdue.length,
  };

  if (summary.terminalFailures > 0 || summary.overdueDeliveries > 0) {
    throw new WorkerRunError(summary);
  }
  return summary;
}
