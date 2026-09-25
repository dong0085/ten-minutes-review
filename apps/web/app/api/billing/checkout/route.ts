import { hasPaidAccess } from "@tmr/core";
import { getSubscription } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user || user.isGuest) {
      return jsonError("Unauthorized", 401);
    }
    const stripe = getStripe();
    if (!env.billingEnabled || !stripe || !env.stripePriceId) {
      return jsonError("Billing is not available right now", 503);
    }
    const subscription = await getSubscription(getDb(), user.id);
    if (hasPaidAccess(subscription)) {
      return jsonError("You already have an active subscription", 409);
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: env.stripePriceId, quantity: 1 }],
      client_reference_id: user.id,
      subscription_data: { metadata: { userId: user.id } },
      ...(subscription?.stripeCustomerId
        ? { customer: subscription.stripeCustomerId }
        : { customer_email: user.email }),
      success_url: `${env.appUrl}/account/plan?billing=success`,
      cancel_url: `${env.appUrl}/account/plan`,
    });
    if (!session.url) {
      return jsonError("Billing is not available right now", 503);
    }
    return jsonOk({ url: session.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
