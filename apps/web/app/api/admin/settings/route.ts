import { z } from "zod";
import { DEFAULT_APP_LIMITS, DEFAULT_LLM_PRICES } from "@tmr/core";
import { getAppLimits, getLlmPrices, saveAppSetting } from "@tmr/db";
import { jsonOk, readJson } from "@/lib/api";
import { adminRoute, audit } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

export const GET = adminRoute(async () => {
  const db = getDb();
  const [limits, llmPrices] = await Promise.all([getAppLimits(db), getLlmPrices(db)]);
  return jsonOk({
    limits,
    llmPrices,
    defaults: { limits: DEFAULT_APP_LIMITS, llmPrices: DEFAULT_LLM_PRICES },
    environment: {
      llmProvider: env.llmProvider,
      llmModel: env.deepseekModel,
      emailProvider: env.emailProvider,
      storageProvider: env.storageProvider,
      billingEnabled: env.billingEnabled,
      stripeConfigured: Boolean(env.stripeSecretKey),
      adminEmails: [...env.adminEmails],
    },
  });
});

const limit = z.number().int().min(0).max(100_000);
const price = z.number().min(0).max(1000);

const settingsSchema = z.object({
  limits: z
    .object({
      freeClassrooms: limit,
      freeNotesUploadsPerWeek: limit,
      uploadsPerUserPerDay: limit,
    })
    .optional(),
  llmPrices: z.object({ input: price, cachedInput: price, output: price }).optional(),
});

export const PUT = adminRoute(async ({ admin, request }) => {
  const body = await readJson(request, settingsSchema);
  const db = getDb();
  if (body.limits) {
    await saveAppSetting(db, "limits", body.limits, admin.id);
    await audit(admin, "update_settings", { type: "setting", id: "limits" }, body.limits);
  }
  if (body.llmPrices) {
    await saveAppSetting(db, "llm_prices", body.llmPrices, admin.id);
    await audit(admin, "update_settings", { type: "setting", id: "llm_prices" }, body.llmPrices);
  }
  return jsonOk({ ok: true });
});
