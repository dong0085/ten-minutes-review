import type { QueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { sessionKey, type Session } from "./session";

export const ONBOARDING_PATH = "/classrooms/start";

// A visitor without an account has no row to record a skip on, so it stays in this browser.
const SKIPPED_KEY = "tmr:onboarding-skipped";

function skippedHere(): boolean {
  try {
    return window.localStorage.getItem(SKIPPED_KEY) === "1";
  } catch {
    return false;
  }
}

/** New visitors and new accounts with no classroom yet go through onboarding first. */
export function needsOnboarding(session: Session | null | undefined, classroomCount: number) {
  if (classroomCount > 0) {
    return false;
  }
  if (!session || session.isGuest) {
    return !skippedHere();
  }
  return session.user.onboardedAt === null;
}

/** Records that onboarding is done or skipped, so the classroom list stops sending the user back. */
export async function markOnboarded(session: Session | null | undefined, queryClient: QueryClient) {
  if (!session || session.isGuest) {
    try {
      window.localStorage.setItem(SKIPPED_KEY, "1");
    } catch {
      // Without storage the visitor just sees onboarding again next time.
    }
    return;
  }
  if (session.user.onboardedAt !== null) {
    return;
  }
  await api.patch("/api/me", { onboarded: true }).catch(() => null);
  queryClient.setQueryData<Session | null>(sessionKey, (current) =>
    current
      ? { ...current, user: { ...current.user, onboardedAt: new Date().toISOString() } }
      : current,
  );
}
