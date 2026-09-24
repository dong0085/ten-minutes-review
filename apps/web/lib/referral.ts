import { getReferralByCode } from "@tmr/db";
import type { Db } from "@tmr/db";

/** Carries a referral code from `/signup?code=…` through the Google sign-in redirect. */
export const REFERRAL_COOKIE_NAME = "tmr_referral";

/** Returns the user who owns a referral code, or null when the code is unknown. */
export async function resolveReferrer(
  db: Db,
  code: string | null | undefined,
): Promise<string | null> {
  if (!code) {
    return null;
  }
  const referral = await getReferralByCode(db, code);
  return referral?.referrerUserId ?? null;
}
