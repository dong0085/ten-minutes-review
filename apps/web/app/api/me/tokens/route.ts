import { createHash } from "node:crypto";
import { z } from "zod";
import { createApiToken, listActiveApiTokensByUser } from "@tmr/db";
import { randomToken } from "@tmr/core/node";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const tokens = await listActiveApiTokensByUser(getDb(), user.id);
    return jsonOk({
      tokens: tokens.map((token) => ({
        id: token.id,
        name: token.name,
        prefix: token.prefix,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return jsonError("Unauthorized", 401);
    }
    const body = await readJson(request, createTokenSchema);
    const token = `tmr_${randomToken()}`;
    const record = await createApiToken(getDb(), {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      prefix: token.slice(0, 8),
      name: body.name ?? "API token",
    });
    return jsonOk(
      {
        token,
        info: {
          id: record.id,
          name: record.name,
          prefix: record.prefix,
          createdAt: record.createdAt,
        },
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
