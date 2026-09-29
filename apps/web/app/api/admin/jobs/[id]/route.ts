import { z } from "zod";
import { cancelPendingJob, getJobById, listLlmCallsForJob, retryJob } from "@tmr/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { adminRoute, audit } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = adminRoute<{ id: string }>(async ({ params }) => {
  const db = getDb();
  const [job, llmCalls] = await Promise.all([getJobById(db, params.id), listLlmCallsForJob(db, params.id)]);
  if (!job) {
    return jsonError("Not found", 404);
  }
  return jsonOk({ job, llmCalls });
});

const actionSchema = z.object({ action: z.enum(["retry", "cancel"]) });

export const POST = adminRoute<{ id: string }>(async ({ admin, request, params }) => {
  const { action } = await readJson(request, actionSchema);
  const db = getDb();
  const job = action === "retry" ? await retryJob(db, params.id) : await cancelPendingJob(db, params.id);
  if (!job) {
    return jsonError(
      action === "retry" ? "Only finished, failed, or cancelled jobs can be retried" : "Only pending jobs can be cancelled",
      409,
    );
  }
  await audit(admin, `${action}_job`, { type: "job", id: job.id }, { kind: job.kind });
  return jsonOk({ job });
});
