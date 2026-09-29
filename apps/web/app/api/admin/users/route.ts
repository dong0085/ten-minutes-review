import { listUsersForAdmin, type AdminUserFilter } from "@tmr/db";
import { jsonOk } from "@/lib/api";
import { adminRoute, intParam } from "@/lib/admin";
import { getDb } from "@/lib/db";

const FILTERS: AdminUserFilter[] = ["all", "registered", "guests", "paid", "comp", "disabled"];

export const GET = adminRoute(async ({ request }) => {
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") as AdminUserFilter | null;
  const result = await listUsersForAdmin(getDb(), {
    q: url.searchParams.get("q") ?? undefined,
    filter: filter && FILTERS.includes(filter) ? filter : "registered",
    offset: intParam(url, "offset", 0),
    limit: intParam(url, "limit", 50, 200),
  });
  return jsonOk(result);
});
