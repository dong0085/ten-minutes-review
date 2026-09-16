import { archiveClassroom, getClassroom } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id } = await context.params;
    const db = getDb();
    const existing = await getClassroom(db, user.id, id);
    if (!existing) {
      return jsonError("Not found", 404);
    }
    const classroom = await archiveClassroom(db, user.id, id);
    return jsonOk({ classroom });
  } catch (error) {
    return handleRouteError(error);
  }
}
