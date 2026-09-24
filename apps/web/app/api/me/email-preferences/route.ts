import { z } from "zod";
import { getEmailPreferences, upsertEmailPreferences } from "@tmr/db";
import type { EmailPreferencesInput } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const updatePreferencesSchema = z.object({
  dailyEnabled: z.boolean().optional(),
  unsubscribedAt: z
    .union([
      z.null(),
      z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date"),
    ])
    .optional(),
  unsubscribed: z.boolean().optional(),
});

function preferencesPayload(row: { dailyEnabled: boolean; unsubscribedAt: Date | null }) {
  return {
    dailyEnabled: row.dailyEnabled,
    unsubscribedAt: row.unsubscribedAt,
  };
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const preferences = await getEmailPreferences(getDb(), user.id);
    if (!preferences) {
      return jsonOk({
        preferences: { dailyEnabled: true, unsubscribedAt: null },
      });
    }
    return jsonOk({ preferences: preferencesPayload(preferences) });
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
    const body = await readJson(request, updatePreferencesSchema);
    const patch: EmailPreferencesInput = {};
    if (body.dailyEnabled !== undefined) {
      patch.dailyEnabled = body.dailyEnabled;
      // Turning the daily email back on also lifts an email-link unsubscribe,
      // which the worker would otherwise keep honouring.
      if (body.dailyEnabled) {
        patch.unsubscribedAt = null;
      }
    }
    if (body.unsubscribedAt !== undefined) {
      patch.unsubscribedAt =
        body.unsubscribedAt === null ? null : new Date(body.unsubscribedAt);
    }
    if (body.unsubscribed !== undefined) {
      patch.unsubscribedAt = body.unsubscribed ? new Date() : null;
    }
    const preferences = await upsertEmailPreferences(getDb(), user.id, patch);
    return jsonOk({ preferences: preferencesPayload(preferences) });
  } catch (error) {
    return handleRouteError(error);
  }
}
