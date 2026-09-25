import { useQuery } from "@tanstack/react-query";
import type { UiTheme } from "@tmr/core";
import { api, isUnauthorized } from "./api";

export type SessionUser = {
  id: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  uiLanguage: string;
  uiTheme: UiTheme | null;
  timezone: string;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type Session = {
  user: SessionUser;
  isGuest: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  plan: { isPaid: boolean; status: string | null };
  features: { billing: boolean; google: boolean };
};

export const sessionKey = ["me"] as const;

/** The signed-in user, the guest, or null for an anonymous visitor. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return await api.get<Session>("/api/me");
      } catch (error) {
        if (isUnauthorized(error)) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Sign-in is a server page, so leaving the SPA needs a full navigation. */
export function goToSignIn() {
  const callbackUrl = window.location.pathname + window.location.search;
  window.location.assign(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}

export async function signOut() {
  const { csrfToken } = await api.get<{ csrfToken: string }>("/api/auth/csrf");
  await fetch("/api/auth/signout", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, callbackUrl: "/" }),
    credentials: "same-origin",
  });
  window.location.assign("/");
}
