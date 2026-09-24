import { getClassroom, listBankForUser } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { toBankItem } from "@/lib/bank";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id } = await context.params;
    const db = getDb();
    const classroom = await getClassroom(db, user.id, id);
    if (!classroom) {
      return jsonError("Not found", 404);
    }
    const rows = await listBankForUser(db, user.id, id);
    return jsonOk({
      knowledgePoints: rows.map((row) => toBankItem(row.point, row.answered, row.missed)),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
