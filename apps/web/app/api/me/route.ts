import { z } from "zod";
import { UI_THEMES } from "@tmr/core";
import { deleteUser, updateUser } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
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

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    return jsonOk({ user: publicUser(user) });
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
