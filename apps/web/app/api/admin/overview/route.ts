import { llmCostUsd, MONTHLY_PRICE_USD } from "@tmr/core";
import { getAdminOverview, getDailySeries, getLlmPrices } from "@tmr/db";
import { jsonOk } from "@/lib/api";
import { adminRoute } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = adminRoute(async () => {
  const db = getDb();
  const [overview, series, prices] = await Promise.all([
    getAdminOverview(db),
    getDailySeries(db, 30),
    getLlmPrices(db),
  ]);
  return jsonOk({
    ...overview,
    mrrUsd: overview.paid.stripe * MONTHLY_PRICE_USD,
    llmCost30dUsd: llmCostUsd(
      {
        inputTokens: overview.llm.inputTokens30d,
        cachedInputTokens: overview.llm.cachedInputTokens30d,
        outputTokens: overview.llm.outputTokens30d,
      },
      prices,
    ),
    series: series.map((day) => ({ ...day, llmCostUsd: llmCostUsd(day, prices) })),
  });
});
