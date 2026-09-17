import { z } from "zod";
import { toUiLocale } from "@tmr/core";
import { randomToken } from "@tmr/core/node";
import { createVerificationToken, getUserByEmail } from "@tmr/db";
import { handleRouteError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { renderVerificationEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

const resendSchema = z.object({
  email: z.email(),
});

export async function POST(request: Request) {
  try {
    const { email } = await readJson(request, resendSchema);
    const db = getDb();
    const user = await getUserByEmail(db, email);
    if (user && !user.emailVerifiedAt) {
      const token = randomToken();
      await createVerificationToken(db, {
        identifier: email,
        token,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        purpose: "verify_email",
      });
      const verificationEmail = await renderVerificationEmail(
        `${env.appUrl}/verify?token=${token}`,
        toUiLocale(user.uiLanguage),
      );
      await sendEmail({ to: email, ...verificationEmail });
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
