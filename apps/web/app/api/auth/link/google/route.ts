import { cookies } from "next/headers";
import { auth, signIn } from "@/lib/auth";
import { LINK_GOOGLE_COOKIE_NAME } from "@/lib/session";

// Starts the Google OAuth flow with a cookie flag so the signIn callback
// attaches the Google identity to the current user instead of signing in.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const store = await cookies();
  store.set(LINK_GOOGLE_COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  await signIn("google", { redirectTo: "/account/security" });
  return new Response(null, { status: 302 });
}
