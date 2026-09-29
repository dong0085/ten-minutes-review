import Stripe from "stripe";
import { jsonError, jsonOk } from "@/lib/api";
import { env } from "@/lib/env";
import { getStripe, syncSubscription } from "@/lib/stripe";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

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
