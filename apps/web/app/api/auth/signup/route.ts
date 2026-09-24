import { cookies } from "next/headers";
import { hash } from "@node-rs/argon2";
import { z } from "zod";
import { toUiLocale } from "@tmr/core";
import { randomToken } from "@tmr/core/node";
import {
  createUser,
  createVerificationToken,
  deleteUser,
  getUserByEmail,
  recordReferralSignup,
  transferClassrooms,
  upsertEmailPreferences,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { renderVerificationEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { resolveReferrer } from "@/lib/referral";
import { GUEST_COOKIE_NAME } from "@/lib/session";

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  referralCode: z.string().trim().min(1).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  uiLanguage: z.string().trim().min(2).max(10).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await readJson(request, signupSchema);
    const db = getDb();
    const existing = await getUserByEmail(db, body.email);
    if (existing) {
      return jsonError("Email already registered", 409);
    }

    const referrerUserId = await resolveReferrer(db, body.referralCode);

    const user = await createUser(db, {
      email: body.email,
      passwordHash: await hash(body.password),
      uiLanguage: body.uiLanguage,
      timezone: body.timezone,
    });

    const token = randomToken();
    await createVerificationToken(db, {
      identifier: body.email,
      token,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      purpose: "verify_email",
    });
    const verificationEmail = await renderVerificationEmail(
      `${env.appUrl}/verify?token=${token}`,
      toUiLocale(body.uiLanguage),
    );
    await sendEmail({ to: body.email, ...verificationEmail });

    if (referrerUserId) {
      await recordReferralSignup(db, {
        referrerUserId,
        sourceCode: body.referralCode ?? null,
        referredUserId: user.id,
      });
    }
    await upsertEmailPreferences(db, user.id, {
      dailyEnabled: true,
      sendHourLocal: 7,
    });

    const cookieStore = await cookies();
    const guestId = cookieStore.get(GUEST_COOKIE_NAME)?.value;
    if (guestId) {
      await transferClassrooms(db, guestId, user.id).catch((err) =>
        console.error("Failed to transfer guest classrooms", err),
      );
      await deleteUser(db, guestId).catch(() => null);
    }

    const response = jsonOk({ ok: true }, 201);
    if (guestId) {
      response.cookies.delete(GUEST_COOKIE_NAME);
    }

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
