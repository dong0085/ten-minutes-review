import { z } from "zod";
import { setKnowledgePointRetired } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

const omitSchema = z.object({
  omit: z.boolean().default(true),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id } = await context.params;

    let omit = true;
    const contentLength = request.headers.get("content-length");
    if (contentLength && contentLength !== "0") {
      const body = await readJson(request, omitSchema).catch(() => ({ omit: true }));
      omit = body.omit;
    }

    const updated = await setKnowledgePointRetired(getDb(), user.id, id, omit);
    if (!updated) {
      return jsonError("Not found", 404);
    }

    return jsonOk({
      ok: true,
      knowledgePoint: {
        id: updated.id,
        classroomId: updated.classroomId,
        targetText: updated.targetText,
        isRetired: updated.retiredAt !== null,
        retiredAt: updated.retiredAt ? updated.retiredAt.toISOString() : null,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
