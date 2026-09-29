import { listAdminAudit } from "@tmr/db";
import { jsonOk } from "@/lib/api";
import { adminRoute, intParam } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = adminRoute(async ({ request }) => {
  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  const rows = await listAdminAudit(getDb(), {
    action: url.searchParams.get("action") || undefined,
    targetType: url.searchParams.get("targetType") || undefined,
    targetId: url.searchParams.get("targetId") || undefined,
    before: before ? new Date(before) : undefined,
    limit: intParam(url, "limit", 100, 500),
  });
  return jsonOk({ rows });
});
