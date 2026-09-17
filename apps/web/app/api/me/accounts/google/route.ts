import { unlinkAccount } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    if (!user.passwordHash) {
      return jsonError("Set a password before unlinking Google", 400);
    }
    const removed = await unlinkAccount(getDb(), user.id, "google");
    return jsonOk({ ok: removed });
  } catch (error) {
    return handleRouteError(error);
  }
}
