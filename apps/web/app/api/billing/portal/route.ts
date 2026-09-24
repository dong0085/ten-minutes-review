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
    if (!env.billingEnabled || !stripe) {
      return jsonError("Billing is not available right now", 503);
    }
    const subscription = await getSubscription(getDb(), user.id);
    if (!subscription?.stripeCustomerId) {
      return jsonError("Not found", 404);
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${env.appUrl}/account`,
    });
    return jsonOk({ url: session.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
