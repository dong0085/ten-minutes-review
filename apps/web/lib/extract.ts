import {
  claimSpecificJob,
  completeJob,
  failJob,
  runExtractJob,
  runInLlmScope,
} from "@tmr/db";
import { getDb } from "./db";
import { getLlmProvider } from "./llm";
import { getObjectBytes } from "./storage";

/**
 * Runs an extract job right away inside the request's `after()`, so a note is
 * read without waiting for the worker. If the worker claimed the job first,
 * this does nothing; if reading fails, the job goes back to the worker's queue.
 */
export async function processExtractJob(jobId: string, userId: string | null): Promise<void> {
  const db = getDb();
  const job = await claimSpecificJob(db, jobId, "web-after");
  if (!job) {
    return;
  }
  try {
    const provider = getLlmProvider();
    await runInLlmScope({ db, jobId, userId }, () =>
      runExtractJob(db, job.payload, {
        extract: (input) => provider.extract(input),
        loadImage: getObjectBytes,
      }),
    );
    await completeJob(db, jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[web-after] extract job ${jobId} failed:`, error);
    await failJob(db, jobId, message);
  }
}
