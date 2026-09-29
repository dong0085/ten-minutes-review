import Stripe from "stripe";
import { getSubscriptionByStripeCustomer, upsertSubscription } from "@tmr/db";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!env.stripeSecretKey) {
    return null;
  }
  client ??= new Stripe(env.stripeSecretKey);
  return client;
}

export function stripeCustomerId(customer: string | { id: string }): string {
  return typeof customer === "string" ? customer : customer.id;
}

/** Copies a Stripe subscription onto the user's row. Returns the user id, or null when unknown. */
export async function syncSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const db = getDb();
  const customerId = stripeCustomerId(subscription.customer);
  const userId =
    subscription.metadata.userId ||
    (await getSubscriptionByStripeCustomer(db, customerId))?.userId;
  if (!userId) {
    console.warn("[stripe] subscription without a known user", subscription.id);
    return null;
  }
  const periodEnd = subscription.items.data[0]?.current_period_end;
  await upsertSubscription(db, {
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    plan: "pro",
    status: subscription.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
  return userId;
}

export function stripeDashboardUrl() {
  return env.stripeSecretKey.startsWith("sk_test_")
    ? "https://dashboard.stripe.com/test"
    : "https://dashboard.stripe.com";
}
