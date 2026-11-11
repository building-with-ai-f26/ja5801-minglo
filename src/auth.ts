import NextAuth, { AuthError } from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
      if (!(error instanceof AuthError) || error.type !== "CredentialsSignin")
        console.error("Authentication error:", error.name);
    },
  },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
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
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.sessionVersion = user.sessionVersion ?? 0;
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
      return session;
    },
  },
});
