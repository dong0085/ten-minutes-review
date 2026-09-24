import Stripe from "stripe";
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
