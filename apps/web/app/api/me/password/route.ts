import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";
import { updateUser } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const body = await readJson(request, changePasswordSchema);
    if (user.passwordHash) {
      const valid =
        body.currentPassword !== undefined &&
        (await verify(user.passwordHash, body.currentPassword).catch(() => false));
      if (!valid) {
        return jsonError("Current password is incorrect", 400);
      }
    }
    await updateUser(getDb(), user.id, { passwordHash: await hash(body.newPassword) });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
