import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { TokenPurpose } from "@tmr/core";
import type { Db } from "../client";
import { accounts, users, verificationTokens } from "../schema/users";

export type CreateUserInput = {
  email: string;
  username?: string | null;
  avatarUrl?: string | null;
  passwordHash?: string | null;
  uiLanguage?: string;
  timezone?: string;
  isGuest?: boolean;
  emailVerifiedAt?: Date | null;
};

export type UpdateUserInput = {
  username?: string | null;
  avatarUrl?: string | null;
  passwordHash?: string | null;
  uiLanguage?: string;
  timezone?: string;
  isGuest?: boolean;
  emailVerifiedAt?: Date | null;
};

export async function getUserById(db: Db, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function getUserByEmail(db: Db, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function createUser(db: Db, input: CreateUserInput) {
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username ?? null,
      avatarUrl: input.avatarUrl ?? null,
      passwordHash: input.passwordHash ?? null,
      uiLanguage: input.uiLanguage ?? "en",
      timezone: input.timezone ?? "UTC",
      isGuest: input.isGuest ?? false,
      emailVerifiedAt: input.emailVerifiedAt ?? null,
    })
    .returning();
  return user;
}

export async function createGuestUser(
  db: Db,
  input?: { uiLanguage?: string; timezone?: string },
) {
  const guestId = crypto.randomUUID();
  const [user] = await db
    .insert(users)
    .values({
      id: guestId,
      email: `guest-${guestId}@guest.local`,
      isGuest: true,
      uiLanguage: input?.uiLanguage ?? "en",
      timezone: input?.timezone ?? "America/Toronto",
    })
    .returning();
  return user;
}

export async function cleanupExpiredGuests(
  db: Db,
  maxAgeMs = 24 * 60 * 60 * 1000,
) {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const deleted = await db
    .delete(users)
    .where(and(eq(users.isGuest, true), lt(users.createdAt, cutoff)))
    .returning({ id: users.id });
  return deleted.length;
}

export async function updateUser(db: Db, id: string, patch: UpdateUserInput) {
  const [user] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return user ?? null;
}

// Every web session carries the version it was issued under; bumping it
// signs the user out everywhere on their next request.
export async function bumpSessionVersion(db: Db, id: string) {
  await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function deleteUser(db: Db, id: string) {
  await db.delete(users).where(eq(users.id, id));
}

export async function getAccountByProvider(db: Db, userId: string, provider: string) {
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
    .limit(1);
  return row ?? null;
}

export async function getUserIdByProviderAccount(
  db: Db,
  provider: string,
  providerAccountId: string,
) {
  const [row] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)))
    .limit(1);
  return row?.userId ?? null;
}

export async function linkAccount(
  db: Db,
  input: { userId: string; provider: string; providerAccountId: string },
) {
  await db
    .insert(accounts)
    .values({ ...input, type: "oauth" })
    .onConflictDoUpdate({
      target: [accounts.provider, accounts.providerAccountId],
      set: { userId: input.userId },
    });
}

export async function unlinkAccount(db: Db, userId: string, provider: string) {
  const removed = await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
    .returning({ provider: accounts.provider });
  return removed.length > 0;
}

export async function createVerificationToken(
  db: Db,
  input: { identifier: string; token: string; expires: Date; purpose: TokenPurpose },
) {
  await db.insert(verificationTokens).values(input);
}

export async function consumeVerificationToken(
  db: Db,
  input: { identifier?: string; token: string; purpose: TokenPurpose },
) {
  const conditions = [
    eq(verificationTokens.token, input.token),
    eq(verificationTokens.purpose, input.purpose),
    gt(verificationTokens.expires, new Date()),
  ];
  if (input.identifier) {
    conditions.push(eq(verificationTokens.identifier, input.identifier));
  }
  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(and(...conditions))
    .limit(1);
  if (!row) {
    return null;
  }
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, row.identifier),
        eq(verificationTokens.token, row.token),
      ),
    );
  return row;
}

export async function deleteExpiredVerificationTokens(db: Db) {
  await db.delete(verificationTokens).where(lt(verificationTokens.expires, new Date()));
}
