import NextAuth, { AuthError } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify, hash, argon2id } from "argon2";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { credentialsSchema } from "@/lib/validation";
import { allowAttempt } from "@/lib/rate-limit";

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
      async authorize(input) {
        const parsed = credentialsSchema.safeParse(input);
        if (!parsed.success) return null;
        const { handle, password } = parsed.data;
        if (!(await allowAttempt("signin", handle, 20))) return null;
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
        return { id: account.id, name: account.handle };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
