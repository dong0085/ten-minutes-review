import { getTutorRequestForUser } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { tutorPayload } from "@/app/api/_lib/tutor";

type RouteContext = { params: Promise<{ id: string }> };

// One tutor reply, polled while the worker writes it.
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id } = await context.params;
    const request = await getTutorRequestForUser(getDb(), user.id, id);
    if (!request) {
      return jsonError("Not found", 404);
    }
    return jsonOk({ request: tutorPayload(request) });
  } catch (error) {
    return handleRouteError(error);
  }
}
