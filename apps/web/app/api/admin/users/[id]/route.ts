import { z } from "zod";
import { llmCostUsd } from "@tmr/core";
import {
  bumpSessionVersion,
  deleteUser,
  endCompPlan,
  getEffectiveLimits,
  getLlmPrices,
  getUserAdminDetail,
  getUserById,
  grantCompPlan,
  listAdminAudit,
  listEmailSendsForUser,
  revokeAllApiTokensByUser,
  revokeApiTokenById,
  setUserDisabled,
  setUserLimitOverride,
  updateUser,
  upsertEmailPreferences,
  getSubscription,
} from "@tmr/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { adminRoute, audit } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { getStripe, stripeDashboardUrl, syncSubscription } from "@/lib/stripe";

type Params = { id: string };

export const GET = adminRoute<Params>(async ({ params }) => {
  const db = getDb();
  const [detail, emails, auditRows, prices, effectiveLimits] = await Promise.all([
    getUserAdminDetail(db, params.id),
    listEmailSendsForUser(db, params.id),
    listAdminAudit(db, { targetType: "user", targetId: params.id, limit: 50 }),
    getLlmPrices(db),
    getEffectiveLimits(db, params.id),
  ]);
  if (!detail) {
    return jsonError("Not found", 404);
  }
  const llm = detail.llm as Record<string, number>;
  return jsonOk({
    ...detail,
    llm: {
      ...llm,
      costUsd: llmCostUsd(
        {
          inputTokens: llm.inputTokens ?? 0,
          cachedInputTokens: llm.cachedInputTokens ?? 0,
          outputTokens: llm.outputTokens ?? 0,
        },
        prices,
      ),
    },
    effectiveLimits,
    emails,
    audit: auditRows,
    stripeDashboard: stripeDashboardUrl(),
  });
});

const count = z.number().int().min(0).max(1000).nullable();

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sign_out") }),
  z.object({ action: z.literal("revoke_tokens") }),
  z.object({ action: z.literal("revoke_token"), tokenId: z.string().uuid() }),
  z.object({ action: z.literal("verify_email") }),
  z.object({ action: z.literal("grant_comp"), months: z.number().int().min(1).max(36) }),
  z.object({ action: z.literal("end_comp") }),
  z.object({
    action: z.literal("set_limits"),
    classrooms: count,
    notesUploadsPerMonth: count,
    note: z.string().trim().max(500).nullable(),
  }),
  z.object({ action: z.literal("daily_email"), enabled: z.boolean() }),
  z.object({ action: z.literal("disable"), reason: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("sync_stripe") }),
  z.object({ action: z.literal("delete"), confirmEmail: z.string() }),
]);

export const POST = adminRoute<Params>(async ({ admin, request, params }) => {
  const body = await readJson(request, actionSchema);
  const db = getDb();
  const user = await getUserById(db, params.id);
  if (!user) {
    return jsonError("Not found", 404);
  }
  const target = { type: "user", id: user.id };
  const { action, ...detail } = body;

  switch (body.action) {
    case "sign_out":
      await bumpSessionVersion(db, user.id);
      break;
    case "revoke_tokens":
      await revokeAllApiTokensByUser(db, user.id);
      break;
    case "revoke_token":
      await revokeApiTokenById(db, { userId: user.id, id: body.tokenId });
      break;
    case "verify_email":
      await updateUser(db, user.id, { emailVerifiedAt: user.emailVerifiedAt ?? new Date() });
      break;
    case "grant_comp": {
      const current = await getSubscription(db, user.id);
      const base =
        current?.plan === "comp" && current.currentPeriodEnd && current.currentPeriodEnd > new Date()
          ? current.currentPeriodEnd
          : new Date();
      const until = new Date(base);
      until.setMonth(until.getMonth() + body.months);
      try {
        await grantCompPlan(db, user.id, until);
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Could not grant", 409);
      }
      Object.assign(detail, { until: until.toISOString() });
      break;
    }
    case "end_comp":
      await endCompPlan(db, user.id);
      break;
    case "set_limits":
      await setUserLimitOverride(db, user.id, {
        classrooms: body.classrooms,
        notesUploadsPerMonth: body.notesUploadsPerMonth,
        note: body.note || null,
      });
      break;
    case "daily_email":
      await upsertEmailPreferences(db, user.id, { dailyEnabled: body.enabled });
      break;
    case "disable":
      await setUserDisabled(db, user.id, body.reason);
      await revokeAllApiTokensByUser(db, user.id);
      break;
    case "enable":
      await setUserDisabled(db, user.id, null);
      break;
    case "sync_stripe": {
      const stripe = getStripe();
      const customerId = (await getSubscription(db, user.id))?.stripeCustomerId;
      if (!stripe || !customerId) {
        return jsonError("No Stripe customer for this user", 409);
      }
      const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
      const latest = list.data[0];
      if (!latest) {
        return jsonError("Stripe has no subscription for this customer", 409);
      }
      await syncSubscription(latest);
      Object.assign(detail, { stripeStatus: latest.status });
      break;
    }
    case "delete":
      if (body.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
        return jsonError("The email does not match", 422);
      }
      {
        const subscription = await getSubscription(db, user.id);
        if (
          subscription?.stripeSubscriptionId &&
          ["active", "trialing", "past_due"].includes(subscription.status)
        ) {
          return jsonError("Cancel the Stripe subscription before deleting this account", 409);
        }
      }
      await audit(admin, "delete_user", target, { email: user.email });
      await deleteUser(db, user.id);
      return jsonOk({ ok: true, deleted: true });
  }
  await audit(admin, action, target, detail);
  return jsonOk({ ok: true });
});
