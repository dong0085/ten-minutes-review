import { EXTRACTION_STATUSES, type ExtractionStatus } from "@tmr/core";
import { listUploadsForAdmin } from "@tmr/db";
import { jsonOk } from "@/lib/api";
import { adminRoute, intParam } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = adminRoute(async ({ request }) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as ExtractionStatus | null;
  const rows = await listUploadsForAdmin(getDb(), {
    status: status && EXTRACTION_STATUSES.includes(status) ? status : undefined,
    offset: intParam(url, "offset", 0),
    limit: intParam(url, "limit", 50, 200),
  });
  return jsonOk({ rows });
});
