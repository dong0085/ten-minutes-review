import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { hasPaidAccess } from "@tmr/core";
import { randomToken } from "@tmr/core/node";
import type { Db } from "../client";
import { referrals, subscriptions, type NewSubscription } from "../schema/billing";

export async function getReferralByCode(db: Db, code: string) {
  const [row] = await db.select().from(referrals).where(eq(referrals.code, code)).limit(1);
  return row ?? null;
}

export async function getOrCreateReferralCode(db: Db, userId: string) {
  const [existing] = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referrerUserId, userId), isNull(referrals.referredUserId)))
    .limit(1);
  if (existing) {
    return existing;
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = randomToken(6);
    const [row] = await db
      .insert(referrals)
      .values({ referrerUserId: userId, code, status: "created" })
      .onConflictDoNothing({ target: referrals.code })
      .returning();
    if (row) {
      return row;
    }
  }
  throw new Error("Could not allocate a referral code");
}

export async function recordReferralSignup(
  db: Db,
  input: { referrerUserId: string; sourceCode?: string | null; referredUserId: string },
) {
  const [existing] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referredUserId, input.referredUserId))
    .limit(1);
  if (existing) {
    return existing;
  }
  const [row] = await db
    .insert(referrals)
    .values({
      referrerUserId: input.referrerUserId,
      sourceCode: input.sourceCode ?? null,
      referredUserId: input.referredUserId,
      status: "signed_up",
    })
    .returning();
  return row;
}

export async function listReferralsByReferrer(db: Db, userId: string) {
  return db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referrerUserId, userId), isNotNull(referrals.referredUserId)))
    .orderBy(desc(referrals.createdAt));
}

export async function getSubscription(db: Db, userId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function getSubscriptionByStripeCustomer(db: Db, stripeCustomerId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row ?? null;
}

export async function upsertSubscription(db: Db, input: NewSubscription) {
  const [row] = await db
    .insert(subscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function hasPaidPlan(db: Db, userId: string) {
  return hasPaidAccess(await getSubscription(db, userId));
}
