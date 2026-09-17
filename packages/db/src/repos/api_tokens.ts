import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../client";
import { apiTokens } from "../schema/api_tokens";

export async function createApiToken(
  db: Db,
  input: { userId: string; tokenHash: string; prefix: string; name: string },
) {
  const [token] = await db.insert(apiTokens).values(input).returning();
  return token;
}

export async function findActiveApiTokenByHash(db: Db, tokenHash: string) {
  const [token] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)))
    .limit(1);
  return token ?? null;
}

export async function touchApiTokenUsed(db: Db, id: string) {
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id));
}

export async function revokeApiTokenByHash(
  db: Db,
  input: { userId: string; tokenHash: string },
) {
  const revoked = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiTokens.tokenHash, input.tokenHash),
        eq(apiTokens.userId, input.userId),
        isNull(apiTokens.revokedAt),
      ),
    )
    .returning({ id: apiTokens.id });
  return revoked.length > 0;
}

export async function revokeApiTokenById(db: Db, input: { userId: string; id: string }) {
  const revoked = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiTokens.id, input.id),
        eq(apiTokens.userId, input.userId),
        isNull(apiTokens.revokedAt),
      ),
    )
    .returning({ id: apiTokens.id });
  return revoked.length > 0;
}
