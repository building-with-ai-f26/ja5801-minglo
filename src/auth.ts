import NextAuth, { AuthError } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import {
  AUTH_COOKIE,
  INTENT_COOKIE,
  cookieOptions,
  googleEnabled,
  googleTestIssuer,
  localAuthTest,
  allowedAuthEmail,
} from "@/lib/account-auth/config";
import {
  createGoogleAccount,
  googleProfileProof,
  completeGoogleLink,
  completeGoogleRecovery,
  readAuthToken,
  AccountAuthError,
} from "@/lib/account-auth/service";
import { verify, hash, argon2id } from "argon2";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { credentialsSchema } from "@/lib/validation";
import { allowAttempt, resetAttempts } from "@/lib/rate-limit";
import { recordActivity } from "@/lib/activity";
import { requestSource } from "@/lib/request-source";

// Unknown handles still perform password verification to reduce timing differences.
let dummyHash: Promise<string> | undefined;
export const { handlers, auth, signIn, signOut } = NextAuth({
  logger: {
    error(error) {
      if (
        error instanceof AuthError &&
        process.env.MINGLO_GOOGLE_TEST_ISSUER &&
        localAuthTest()
      ) {
        console.error(
          "Local OAuth fixture diagnostic:",
          error.type,
          error.cause?.err?.message,
        );
      }
      if (!(error instanceof AuthError) || error.type !== "CredentialsSignin")
        console.error("Authentication error:", error.name);
    },
  },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(googleEnabled()
      ? [
          Google({
            issuer: googleTestIssuer() ?? "https://accounts.google.com",
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            authorization: {
              params: {
                scope: "openid email profile",
                prompt: "select_account",
              },
            },
            checks: ["pkce", "state", "nonce"],
          }),
        ]
      : []),
    Credentials({
      id: "google-complete",
      credentials: { handle: {}, displayName: {} },
      async authorize(input, request) {
        if (!googleEnabled() || (await auth())?.user) return null;
        if (
          !(await allowAttempt(
            "google-signup",
            requestSource(request.headers),
            10,
          ))
        )
          return null;
        const token = (await cookies()).get(AUTH_COOKIE)?.value ?? "";
        try {
          const account = await createGoogleAccount(
            token,
            input.handle,
            input.displayName,
          );
          (await cookies()).delete(AUTH_COOKIE);
          return {
            id: account.id,
            name: account.handle,
            sessionVersion: account.sessionVersion,
          };
        } catch (error) {
          if (error instanceof AccountAuthError) return null;
          throw error;
        }
      },
    }),
    Credentials({
      credentials: {
        handle: { label: "Handle" },
        password: { label: "Password", type: "password" },
      },
      async authorize(input, request) {
        const parsed = credentialsSchema.safeParse(input);
        if (!parsed.success) return null;
        const { handle, password } = parsed.data;
        const source = requestSource(request.headers);
        // Limit computational work and password spraying across handles, while
        // isolating a targeted handle's failed allowance to the observed source.
        if (!(await allowAttempt("signin-source", source, 100))) return null;
        const pair = `${source}:${handle}`;
        if (!(await allowAttempt("signin-pair", pair, 20))) return null;
        const account = await db.account.findUnique({ where: { handle } });
        dummyHash ??= hash(randomBytes(32), {
          type: argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        });
        const valid = await verify(
          account?.passwordHash ?? (await dummyHash),
          password,
        );
        if (!account || !valid) return null;
        await resetAttempts("signin-pair", pair);
        await recordActivity(account.id, { force: true });
        return {
          id: account.id,
          name: account.handle,
          sessionVersion: account.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      if (
        !googleEnabled() ||
        profile?.email_verified !== true ||
        typeof profile.email !== "string" ||
        !allowedAuthEmail(profile.email)
      )
        return "/login?authError=trial";
      const subject = account.providerAccountId;
      const jar = await cookies();
      const intentToken = jar.get(INTENT_COOKIE)?.value;
      const session = await auth();
      if (intentToken) {
        jar.delete(INTENT_COOKIE);
        if (!session?.user?.id || session.sessionVersion === undefined)
          return "/login?authError=link";
        const proof = await googleProfileProof(
          subject,
          profile.email,
          "/settings",
        );
        try {
          await completeGoogleLink(intentToken, proof, {
            id: session.user.id,
            sessionVersion: session.sessionVersion,
          });
          return "/settings?connected=1";
        } catch (error) {
          if (error instanceof AccountAuthError)
            return "/settings?authError=link";
          throw error;
        }
      }
      const identity = await db.signInIdentity.findUnique({
        where: { provider_subject: { provider: "google", subject } },
        include: { account: true },
      });
      if (identity) {
        if (identity.account.type !== "OWNER") return false;
        // Never silently switch a signed-in browser to a different Minglo account.
        if (session?.user?.id && session.user.id !== identity.accountId)
          return "/settings?authError=link";
        await completeGoogleRecovery(
          identity.accountId,
          subject,
          profile.email,
        );
        user.id = identity.accountId;
        user.name = identity.account.handle;
        user.email = null;
        user.image = null;
        user.sessionVersion = identity.account.sessionVersion;
        await recordActivity(identity.accountId, { force: true });
        return true;
      }
      if (session?.user?.id) return "/settings?authError=link";
      const nextToken = jar.get("minglo-google-next")?.value;
      const nextProof = nextToken
        ? await readAuthToken(nextToken, "google-next")
        : null;
      const proof = await googleProfileProof(
        subject,
        profile.email,
        nextProof?.nextPath ?? "/dashboard",
      );
      jar.set(AUTH_COOKIE, proof, cookieOptions());
      return "/auth/google";
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.sessionVersion = user.sessionVersion ?? 0;
        token.authenticatedAt = Date.now();
        delete token.email;
        delete token.picture;
      }
      if (!token.sub) return null;
      const account = await db.account.findUnique({
        where: { id: token.sub },
        select: { sessionVersion: true },
      });
      // Legacy sessions start at version zero; recovery invalidates them atomically.
      if (!account || account.sessionVersion !== (token.sessionVersion ?? 0))
        return null;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      session.authenticatedAt =
        typeof token.authenticatedAt === "number"
          ? token.authenticatedAt
          : undefined;
      session.sessionVersion =
        typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      return session;
    },
  },
});
