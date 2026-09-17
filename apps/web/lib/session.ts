import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  findActiveApiTokenByHash,
  getUserById,
  touchApiTokenUsed,
  type User,
} from "@tmr/db";
import { auth } from "./auth";
import { getDb } from "./db";

export const GUEST_COOKIE_NAME = "tmr_guest_id";

const TOKEN_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

const BEARER_SCHEME = /^Bearer\s+(.+)$/i;

// Returns undefined when no bearer header is present, so callers fall through
// to cookie auth; any other result is final.
async function userFromBearer(): Promise<User | null | undefined> {
  const match = BEARER_SCHEME.exec((await headers()).get("authorization") ?? "");
  if (!match) {
    return undefined;
  }
  const tokenHash = createHash("sha256").update(match[1] as string).digest("hex");
  const token = await findActiveApiTokenByHash(getDb(), tokenHash);
  if (!token) {
    return null;
  }
  const stale =
    !token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > TOKEN_TOUCH_INTERVAL_MS;
  if (stale) {
    await touchApiTokenUsed(getDb(), token.id).catch(() => null);
  }
  return (await getUserById(getDb(), token.userId)) ?? null;
}

export async function getSessionUser(): Promise<User | null> {
  const bearer = await userFromBearer();
  if (bearer !== undefined) {
    return bearer;
  }
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const user = await getUserById(getDb(), session.user.id);
  return user ?? null;
}

export async function getCurrentUserOrGuest(): Promise<{
  user: User;
  isGuest: boolean;
} | null> {
  const bearer = await userFromBearer();
  if (bearer !== undefined) {
    return bearer ? { user: bearer, isGuest: false } : null;
  }
  const user = await getSessionUser();
  if (user) {
    return { user, isGuest: Boolean(user.isGuest) };
  }
  try {
    const store = await cookies();
    const guestId = store.get(GUEST_COOKIE_NAME)?.value;
    if (guestId) {
      const guest = await getUserById(getDb(), guestId);
      if (guest && guest.isGuest) {
        return { user: guest, isGuest: true };
      }
    }
  } catch {
    // Ignore when cookies() cannot be accessed
  }
  return null;
}

export async function requireUser(options?: { allowGuest?: boolean }) {
  if (options?.allowGuest) {
    const current = await getCurrentUserOrGuest();
    if (current) {
      return current.user;
    }
    redirect("/signin");
  }
  const user = await getSessionUser();
  if (!user) {
    redirect("/signin");
  }
  return user;
}
