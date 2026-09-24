import Stripe from "stripe";
import { getSubscriptionByStripeCustomer, upsertSubscription } from "@tmr/db";
import { jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe, stripeCustomerId } from "@/lib/stripe";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

async function syncSubscription(subscription: Stripe.Subscription) {
  const db = getDb();
  const customerId = stripeCustomerId(subscription.customer);
  const userId =
    subscription.metadata.userId ||
    (await getSubscriptionByStripeCustomer(db, customerId))?.userId;
  if (!userId) {
    console.warn("[stripe] subscription without a known user", subscription.id);
    return;
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
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) {
    return jsonOk({ received: true });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("Missing stripe-signature header", 400);
  }
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid signature", 400);
  }
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    await syncSubscription(event.data.object as Stripe.Subscription);
  }
  return jsonOk({ received: true });
}
