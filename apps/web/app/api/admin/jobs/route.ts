import { JOB_KINDS, JOB_STATUSES, type JobKind, type JobStatus } from "@tmr/core";
import { getJobCounts, listJobsForAdmin } from "@tmr/db";
import { jsonOk } from "@/lib/api";
import { adminRoute, intParam } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = adminRoute(async ({ request }) => {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as JobKind | null;
  const status = url.searchParams.get("status") as JobStatus | "stuck" | null;
  const db = getDb();
  const [rows, counts] = await Promise.all([
    listJobsForAdmin(db, {
      kind: kind && JOB_KINDS.includes(kind) ? kind : undefined,
      status: status === "stuck" || (status && JOB_STATUSES.includes(status)) ? status : undefined,
      offset: intParam(url, "offset", 0),
      limit: intParam(url, "limit", 50, 200),
    }),
    getJobCounts(db),
  ]);
  return jsonOk({ rows, counts });
});
