import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import {
  bumpSessionVersion,
  createUser,
  deleteUser,
  extendClassroomActivityForLogin,
  getUserByEmail,
  getUserIdByProviderAccount,
  getUserById,
  linkAccount,
  recordReferralSignup,
  revokeAllApiTokensByUser,
  transferClassrooms,
  updateUser,
  upsertEmailPreferences,
} from "@tmr/db";
import { env } from "./env";
import { verifyCredentials } from "./credentials";
import { getDb } from "./db";
import { REFERRAL_COOKIE_NAME, resolveReferrer } from "./referral";
import { GUEST_COOKIE_NAME, LINK_GOOGLE_COOKIE_NAME } from "./session";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const providers: NextAuthConfig["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Auth.js only infers AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET, so pass ours in.
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

providers.push(
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email : null;
      const password = typeof credentials?.password === "string" ? credentials.password : null;
      if (!email || !password) {
        return null;
      }
      const user = await verifyCredentials(email, password);
      if (!user) {
        return null;
      }
      return { id: user.id, email: user.email, name: user.username ?? user.email };
    },
  }),
);

export const authConfig: NextAuthConfig = {
  secret: env.authSecret,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers,
  events: {
    async signIn({ user }) {
      if (user.id) {
        await extendClassroomActivityForLogin(getDb(), user.id);
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }
      const db = getDb();
      const store = await cookies();

      if (account?.provider === "google" && account.providerAccountId) {
        const providerAccountId = String(account.providerAccountId);

        // Explicit link started from account settings: attach the Google
        // identity to the signed-in user rather than signing in fresh.
        if (store.get(LINK_GOOGLE_COOKIE_NAME)?.value) {
          store.delete(LINK_GOOGLE_COOKIE_NAME);
          const session = await auth();
          const sessionUserId = session?.user?.id;
          const sessionUser = sessionUserId ? await getUserById(db, sessionUserId) : null;
          if (!sessionUser || sessionUser.isGuest) {
            return "/account/security?linkError=session";
          }
          if (user.email.toLowerCase() !== sessionUser.email.toLowerCase()) {
            return "/account/security?linkError=email";
          }
          await linkAccount(db, {
            userId: sessionUser.id,
            provider: "google",
            providerAccountId,
          });
          if (!sessionUser.emailVerifiedAt) {
            await updateUser(db, sessionUser.id, { emailVerifiedAt: new Date() });
          }
          user.id = sessionUser.id;
          return true;
        }

        const linkedUserId = await getUserIdByProviderAccount(db, "google", providerAccountId);
        if (linkedUserId) {
          user.id = linkedUserId;
          const guestId = store.get(GUEST_COOKIE_NAME)?.value;
          if (guestId && guestId !== linkedUserId) {
            await transferClassrooms(db, guestId, linkedUserId).catch(() => null);
            await deleteUser(db, guestId).catch(() => null);
          }
          return true;
        }
      }

      const existing = await getUserByEmail(db, user.email);
      if (existing) {
        user.id = existing.id;
        if (account?.provider === "google" && account.providerAccountId) {
          // Google proves the address belongs to this person. If nobody had
          // verified it before, a password set at signup may belong to someone
          // else who registered the address first, so drop it and sign out
          // every session and token issued under it.
          if (!existing.emailVerifiedAt && profile?.email_verified !== true) {
            return "/signin?error=OAuthAccountNotLinked";
          }
          await linkAccount(db, {
            userId: existing.id,
            provider: "google",
            providerAccountId: String(account.providerAccountId),
          });
          if (!existing.emailVerifiedAt) {
            await updateUser(db, existing.id, { emailVerifiedAt: new Date(), passwordHash: null });
            await revokeAllApiTokensByUser(db, existing.id);
            await bumpSessionVersion(db, existing.id);
          }
        }
        const guestId = store.get(GUEST_COOKIE_NAME)?.value;
        if (guestId && guestId !== existing.id) {
          await transferClassrooms(db, guestId, existing.id).catch(() => null);
          await deleteUser(db, guestId).catch(() => null);
        }
        return true;
      }
      if (account?.provider === "credentials") {
        return true;
      }
      const sourceCode = store.get(REFERRAL_COOKIE_NAME)?.value ?? null;
      const referrerUserId = await resolveReferrer(db, sourceCode);
      const created = await createUser(db, {
        email: user.email,
        username: user.name ?? null,
        avatarUrl: user.image ?? null,
        emailVerifiedAt: new Date(),
      });
      if (!created) {
        return false;
      }
      user.id = created.id;

      const guestId = store.get(GUEST_COOKIE_NAME)?.value;
      if (guestId && guestId !== created.id) {
        await transferClassrooms(db, guestId, created.id).catch(() => null);
        await deleteUser(db, guestId).catch(() => null);
      }

      await upsertEmailPreferences(db, created.id, {
        dailyEnabled: true,
        sendHourLocal: 7,
      });
      if (referrerUserId) {
        await recordReferralSignup(db, {
          referrerUserId,
          sourceCode,
          referredUserId: created.id,
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      if (!token.userId && token.email) {
        const dbUser = await getUserByEmail(getDb(), token.email);
        if (dbUser) {
          token.userId = dbUser.id;
        }
      }
      if (typeof token.userId !== "string") {
        return token;
      }
      // A database hiccup should keep people signed in, so only a successful
      // lookup can end the session.
      const dbUser = await getUserById(getDb(), token.userId).catch(() => undefined);
      if (dbUser === undefined) {
        return token;
      }
      if (!dbUser) {
        return null;
      }
      if (user) {
        token.sessionVersion = dbUser.sessionVersion;
      } else if ((token.sessionVersion ?? 0) !== dbUser.sessionVersion) {
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
