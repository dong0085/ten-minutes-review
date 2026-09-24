import { z } from "zod";
import { updateKnowledgePointText } from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { toKnowledgePointJson } from "@/lib/bank";
import { getDb } from "@/lib/db";
import { getCurrentUserOrGuest } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .transform((value) => (value === "" ? null : value));

const updateSchema = z
  .object({
    targetText: z.string().trim().min(1).max(2000).optional(),
    nativeText: optionalText,
    note: optionalText,
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined));

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id } = await context.params;
    const body = await readJson(request, updateSchema);
    const fields = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );

    const updated = await updateKnowledgePointText(getDb(), user.id, id, fields);
    if (!updated) {
      return jsonError("Not found", 404);
    }

    return jsonOk({ knowledgePoint: toKnowledgePointJson(updated) });
  } catch (error) {
    return handleRouteError(error);
  }
}
