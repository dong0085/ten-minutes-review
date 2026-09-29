import { llmCostUsd, type TokenCounts } from "@tmr/core";
import { getLlmPrices, getLlmUsage } from "@tmr/db";
import { jsonOk } from "@/lib/api";
import { adminRoute, intParam } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = adminRoute(async ({ request }) => {
  const url = new URL(request.url);
  const days = Math.max(1, intParam(url, "days", 30, 365));
  const db = getDb();
  const [usage, prices] = await Promise.all([getLlmUsage(db, days), getLlmPrices(db)]);
  const withCost = <T extends Record<string, unknown>>(row: T) => ({
    ...row,
    costUsd: llmCostUsd(row as unknown as TokenCounts, prices),
  });
  return jsonOk({
    days,
    prices,
    byDay: usage.byDay.map(withCost),
    byPurpose: usage.byPurpose.map(withCost),
    byModel: usage.byModel,
    topUsers: usage.topUsers.map(withCost),
    recentErrors: usage.recentErrors,
  });
});
