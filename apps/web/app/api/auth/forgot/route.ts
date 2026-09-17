import { z } from "zod";
import { toUiLocale } from "@tmr/core";
import { randomToken } from "@tmr/core/node";
import { createVerificationToken, getUserByEmail } from "@tmr/db";
import { handleRouteError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { renderPasswordResetEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

const forgotSchema = z.object({
  email: z.email(),
});

export async function POST(request: Request) {
  try {
    const { email } = await readJson(request, forgotSchema);
    const db = getDb();
    const user = await getUserByEmail(db, email);
    if (user) {
      const token = randomToken();
      await createVerificationToken(db, {
        identifier: email,
        token,
        expires: new Date(Date.now() + 60 * 60 * 1000),
        purpose: "reset_password",
      });
      const resetEmail = await renderPasswordResetEmail(
        `${env.appUrl}/reset?token=${token}`,
        toUiLocale(user.uiLanguage),
      );
      await sendEmail({ to: email, ...resetEmail });
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
