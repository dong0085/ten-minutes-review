import { getActiveComposeJob, getClassroom, markJobCancelled, requestJobCancel } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

// Stops the exam being written. A running job is asked to stop and checks before it saves.
export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const { id } = await context.params;
    const db = getDb();
    const classroom = await getClassroom(db, user.id, id);
    if (!classroom) {
      return jsonError("Not found", 404);
    }
    const job = await getActiveComposeJob(db, id, "exam");
    if (!job) {
      return jsonOk({ outcome: "none" });
    }
    if (job.status === "pending") {
      await markJobCancelled(db, job.id);
    } else {
      await requestJobCancel(db, job.id);
    }
    return jsonOk({ outcome: "stopped" });
  } catch (error) {
    return handleRouteError(error);
  }
}
