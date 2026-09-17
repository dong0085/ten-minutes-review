import { createHash } from "node:crypto";
import { z } from "zod";
import { createApiToken, extendClassroomActivityForLogin } from "@tmr/db";
import { randomToken } from "@tmr/core/node";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { verifyCredentials } from "@/lib/credentials";
import { getDb } from "@/lib/db";
import { publicUser } from "@/app/api/_lib/user";

const bodySchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
  deviceName: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await readJson(request, bodySchema);
    const user = await verifyCredentials(body.email, body.password);
    if (!user) {
      return jsonError("Invalid email or password", 401, "invalid_credentials");
    }
    const token = `tmr_${randomToken()}`;
    await createApiToken(getDb(), {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      prefix: token.slice(0, 8),
      name: body.deviceName ?? "API token",
    });
    await extendClassroomActivityForLogin(getDb(), user.id);
    return jsonOk({ token, user: publicUser(user) });
  } catch (error) {
    return handleRouteError(error);
  }
}
