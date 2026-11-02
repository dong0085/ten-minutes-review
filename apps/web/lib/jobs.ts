import { after } from "next/server";
import { claimSpecificJob, completeJob, failJob, getJobById } from "@tmr/db";
import { runJob } from "worker/jobs";
import { getDb } from "./db";

/**
 * Runs a worker job (compose, tutor, summarize) right after the response, so
 * the learner does not wait for the hourly worker run. If the worker claimed
 * the job first, this does nothing. A failed try is retried here until the job
 * runs out of attempts; if the function times out, the worker picks it up.
 */
export function runJobAfterResponse(jobId: string): void {
  after(() => runJobNow(jobId));
}

async function runJobNow(jobId: string): Promise<void> {
  const db = getDb();
  const job = await claimSpecificJob(db, jobId, "web-after");
  if (!job) {
    return;
  }
  try {
    await runJob(db, job);
    await completeJob(db, jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[web-after] ${job.kind} job ${jobId} failed:`, error);
    const { terminal } = await failJob(db, jobId, message);
    if (!terminal) {
      await runJobNow(jobId);
    }
    return;
  }
  // An on-demand quiz queues its email; send that now too.
  const emailJobId = (await getJobById(db, jobId))?.payload.emailJobId;
  if (typeof emailJobId === "string") {
    await runJobNow(emailJobId);
  }
}
