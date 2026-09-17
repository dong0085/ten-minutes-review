import { createHash } from "node:crypto";
import { revokeApiTokenByHash } from "@tmr/db";
import { jsonError, jsonOk } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const raw = header.slice("Bearer ".length).trim();
  if (!header.startsWith("Bearer ") || !raw) {
    return jsonError("Unauthorized", 401);
  }
  const user = await getSessionUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  await revokeApiTokenByHash(getDb(), { userId: user.id, tokenHash });
  return jsonOk({ ok: true });
}
