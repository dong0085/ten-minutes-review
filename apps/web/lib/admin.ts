import { headers } from "next/headers";
import { logAdminAction, type User } from "@tmr/db";
import { handleRouteError, jsonError } from "./api";
import { getDb } from "./db";
import { env } from "./env";
import { getSessionUser } from "./session";

export function isAdminUser(user: Pick<User, "email" | "emailVerifiedAt" | "isGuest">) {
  return !user.isGuest && Boolean(user.emailVerifiedAt) && env.adminEmails.has(user.email.toLowerCase());
}

/** The signed-in admin, from the session cookie only; API tokens never reach admin routes. */
export async function getAdmin(): Promise<User | null> {
  if ((await headers()).get("authorization")) {
    return null;
  }
  const user = await getSessionUser();
  return user && isAdminUser(user) ? user : null;
}

export type AdminContext<P> = { admin: User; request: Request; params: P };

/** Wraps an admin route handler: checks access and turns thrown errors into JSON. */
export function adminRoute<P = Record<string, never>>(
  handler: (context: AdminContext<P>) => Promise<Response>,
) {
  return async (request: Request, context: { params: Promise<P> }) => {
    try {
      const admin = await getAdmin();
      if (!admin) {
        return jsonError("Forbidden", 403);
      }
      return await handler({ admin, request, params: await context.params });
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

export async function audit(
  admin: User,
  action: string,
  target: { type: string; id: string } | null,
  detail: Record<string, unknown> = {},
) {
  await logAdminAction(getDb(), {
    adminUserId: admin.id,
    adminEmail: admin.email,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    detail,
  });
}

/** Reads `?name=` as a bounded non-negative integer. */
export function intParam(url: URL, name: string, fallback: number, max = 10_000) {
  const raw = url.searchParams.get(name);
  const value = raw ? Number(raw) : NaN;
  return Number.isInteger(value) && value >= 0 ? Math.min(value, max) : fallback;
}
