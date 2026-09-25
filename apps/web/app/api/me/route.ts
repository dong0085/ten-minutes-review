import { z } from "zod";
import { hasPaidAccess, UI_THEMES } from "@tmr/core";
import { deleteUser, getAccountByProvider, getSubscription, updateUser } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUserOrGuest, getSessionUser } from "@/lib/session";
import { isTimezone, publicUser } from "@/app/api/_lib/user";

const updateMeSchema = z.object({
  username: z.union([z.string().trim().min(1).max(80), z.null()]).optional(),
  uiLanguage: z.string().trim().min(2).max(10).optional(),
  uiTheme: z.enum(UI_THEMES).optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isTimezone, "Invalid timezone")
    .optional(),
});

// Guests resolve here too, so the web app can boot from one call.
export async function GET() {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user, isGuest } = current;
    const db = getDb();
    const [subscription, googleAccount] = await Promise.all([
      getSubscription(db, user.id),
      getAccountByProvider(db, user.id, "google"),
    ]);
    return jsonOk({
      user: publicUser(user),
      isGuest,
      hasPassword: Boolean(user.passwordHash),
      googleLinked: Boolean(googleAccount),
      plan: {
        isPaid: hasPaidAccess(subscription),
        status: subscription?.status ?? null,
      },
      features: { billing: env.billingEnabled, google: Boolean(process.env.GOOGLE_CLIENT_ID) },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const body = await readJson(request, updateMeSchema);
    const updated = await updateUser(getDb(), user.id, {
      username: body.username,
      uiLanguage: body.uiLanguage,
      uiTheme: body.uiTheme,
      timezone: body.timezone,
    });
    if (!updated) {
      return jsonError("Not found", 404);
    }
    return jsonOk({ user: publicUser(updated) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    await deleteUser(getDb(), user.id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
