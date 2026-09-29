import { MONTHLY_PRICE_USD } from "@tmr/core";
import { listSubscriptionsForAdmin } from "@tmr/db";
import { jsonOk } from "@/lib/api";
import { adminRoute } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { stripeDashboardUrl } from "@/lib/stripe";

export const GET = adminRoute(async ({ request }) => {
  const status = new URL(request.url).searchParams.get("status");
  const rows = await listSubscriptionsForAdmin(getDb(), {
    status: status === "live" || status === "comp" || status === "ended" ? status : undefined,
  });
  return jsonOk({
    rows,
    priceUsd: MONTHLY_PRICE_USD,
    stripeDashboard: stripeDashboardUrl(),
  });
});
