import { createHash, randomBytes } from "node:crypto";
import { hash, verify, argon2id } from "argon2";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { handleSchema, credentialsSchema, safeNext } from "../validation";
import { allowAttempt } from "../rate-limit";
import {
  allowedAuthEmail,
  authOrigin,
  emailAuthEnabled,
  authRollout,
} from "./config";
import { notifyAccount, sendAccountEmail } from "./mail";

export class AccountAuthError extends Error {}
export const tokenDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const emailSchema = z.string().trim().toLowerCase().email().max(254);
export function normalizeEmail(input: unknown) {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success)
    throw new AccountAuthError("Enter a valid email address.");
  return parsed.data; // Do not collapse dots or +aliases across providers.
}
export type RecentActor = {
  id: string;
  sessionVersion: number;
  authenticatedAt?: number;
};
async function lockAccount(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${id} FOR UPDATE`;
  const account = await tx.account.findUnique({ where: { id } });
  if (!account || account.type !== "OWNER")
    throw new AccountAuthError("This setting is for your human account.");
  return account;
}
export async function requireRecent(
  tx: Prisma.TransactionClient,
  actor: RecentActor,
  password: string,
) {
  const account = await lockAccount(tx, actor.id);
  if (account.sessionVersion !== actor.sessionVersion)
    throw new AccountAuthError("Sign in again to continue.");
  const age = Date.now() - (actor.authenticatedAt ?? 0);
  if (age >= 0 && age < 10 * 60_000) return account;
  if (
    !account.passwordHash ||
    password.length > 128 ||
    !password ||
    !(await verify(account.passwordHash, password))
  )
    throw new AccountAuthError(
      "Enter your current password or sign in again, then retry.",
    );
  return account;
}
async function issueToken(
  tx: Prisma.TransactionClient,
  data: {
    purpose: string;
    accountId?: string;
    sessionVersion?: number;
    email?: string;
    subject?: string;
    nextPath?: string;
  },
  minutes = 10,
) {
  await tx.accountAuthToken.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 86400_000) } },
  });
  const token = randomBytes(32).toString("base64url");
  await tx.accountAuthToken.create({
    data: {
      ...data,
      tokenHash: tokenDigest(token),
      expiresAt: new Date(Date.now() + minutes * 60_000),
    },
  });
  return token;
}
export async function readAuthToken(token: string, purpose: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return db.accountAuthToken.findFirst({
    where: {
      tokenHash: tokenDigest(token),
      purpose,
      expiresAt: { gt: new Date() },
    },
  });
}
async function consume(tx: Prisma.TransactionClient, tokenHash: string) {
  const result = await tx.accountAuthToken.deleteMany({
    where: { tokenHash, expiresAt: { gt: new Date() } },
  });
  if (result.count !== 1)
    throw new AccountAuthError(
      "This link has expired or was already used. Start again.",
    );
}
const passwordHash = (password: string) =>
  hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
function checkedPassword(password: string) {
  const parsed = credentialsSchema.shape.password.safeParse(password);
  if (!parsed.success)
    throw new AccountAuthError(parsed.error.issues[0].message);
  return parsed.data;
}
export async function requestEmailVerification(
  actor: RecentActor,
  input: unknown,
  password: string,
) {
  if (!emailAuthEnabled())
    throw new AccountAuthError("Email recovery is not available yet.");
  const email = normalizeEmail(input);
  if (!allowedAuthEmail(email))
    throw new AccountAuthError(
      "This email is not included in the current trial.",
    );
  const token = await db.$transaction(async (tx) => {
    const account = await requireRecent(tx, actor, password);
    if (account.recoveryEmail === email)
      throw new AccountAuthError("This recovery email is already verified.");
    await tx.accountAuthToken.deleteMany({
      where: { accountId: actor.id, purpose: "verify-email" },
    });
    return issueToken(
      tx,
      {
        purpose: "verify-email",
        accountId: actor.id,
        sessionVersion: account.sessionVersion,
        email,
      },
      30,
    );
  });
  try {
    await sendAccountEmail(
      email,
      "Verify your Minglo recovery email",
      `Confirm this address for your Minglo account:\n${authOrigin()}/auth/verify-email?token=${token}\n\nThis link expires in 30 minutes. If you didn't request it, ignore this email.`,
    );
  } catch (error) {
    await db.accountAuthToken.deleteMany({
      where: { tokenHash: tokenDigest(token) },
    });
    throw error;
  }
}
export async function verifyRecoveryEmail(token: string, actorId: string) {
  const proof = await readAuthToken(token, "verify-email");
  if (!proof?.accountId || !proof.email || proof.accountId !== actorId)
    throw new AccountAuthError(
      "Sign in to the account that requested this link. The link may also have expired.",
    );
  let oldEmail: string | null;
  try {
    oldEmail = await db.$transaction(async (tx) => {
      const account = await lockAccount(tx, actorId);
      if (account.sessionVersion !== proof.sessionVersion)
        throw new AccountAuthError(
          "Sign in and request a new verification link.",
        );
      await consume(tx, proof.tokenHash);
      await tx.accountAuthToken.deleteMany({
        where: { accountId: actorId, purpose: "reset-password" },
      });
      await tx.account.update({
        where: { id: actorId },
        data: { recoveryEmail: proof.email, emailVerifiedAt: new Date() },
      });
      return account.recoveryEmail;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AccountAuthError(
        "This address cannot be connected. Use another email or recover your existing account.",
      );
    throw error;
  }
  await notifyAccount(
    oldEmail,
    "Your recovery email was changed. The previous address can no longer reset your password.",
  );
}
// Called after the public response so account existence and provider timing are not exposed.
export async function requestPasswordReset(input: unknown, source: string) {
  if (!emailAuthEnabled()) return;
  let email: string;
  try {
    email = normalizeEmail(input);
  } catch {
    return;
  }
  if (
    !allowedAuthEmail(email) ||
    !(await allowAttempt("email-reset-address", email, 3, db, 3600))
  )
    return;
  if (!(await allowAttempt("email-reset-delivery", source, 10, db, 3600)))
    return;
  const account = await db.account.findUnique({
    where: { recoveryEmail: email },
  });
  if (!account || account.type !== "OWNER" || !account.emailVerifiedAt) return;
  if (!account.passwordHash) {
    await sendAccountEmail(
      email,
      "Sign in to Minglo",
      "This account uses Google sign-in. Continue with Google at " +
        authOrigin() +
        "/login. You can set a Minglo password in Settings after signing in.",
    );
    return;
  }
  const token = await db.$transaction(async (tx) => {
    const current = await lockAccount(tx, account.id);
    if (current.recoveryEmail !== email) return null;
    // Keep other unexpired links valid until a reset succeeds, so repeated requests cannot invalidate a delivered link.
    return issueToken(
      tx,
      {
        purpose: "reset-password",
        accountId: account.id,
        sessionVersion: current.sessionVersion,
        email,
      },
      30,
    );
  });
  if (token)
    await sendAccountEmail(
      email,
      "Reset your Minglo password",
      `Choose a new password:\n${authOrigin()}/auth/reset-password?token=${token}\n\nThis link expires in 30 minutes and works once. If you didn't request it, ignore this email.`,
    );
}
export async function resetEmailPassword(token: string, password: string) {
  const proof = await readAuthToken(token, "reset-password");
  if (!proof?.accountId)
    throw new AccountAuthError(
      "This link has expired or was already used. Request another link.",
    );
  const hashed = await passwordHash(checkedPassword(password));
  const email = await db.$transaction(async (tx) => {
    const account = await lockAccount(tx, proof.accountId!);
    if (
      account.sessionVersion !== proof.sessionVersion ||
      account.recoveryEmail !== proof.email ||
      !account.passwordHash
    )
      throw new AccountAuthError(
        "This link is no longer valid. Request another link.",
      );
    await consume(tx, proof.tokenHash);
    await tx.account.update({
      where: { id: account.id },
      data: { passwordHash: hashed, sessionVersion: { increment: 1 } },
    });
    await tx.accountAuthToken.deleteMany({ where: { accountId: account.id } });
    await tx.recoveryCode.deleteMany({ where: { accountId: account.id } });
    return account.recoveryEmail;
  });
  await notifyAccount(
    email,
    "Your password was reset. Previous sessions, reset links and backup recovery codes have been invalidated. Sign in again and generate fresh backup codes.",
  );
}
export async function setAccountPassword(
  actor: RecentActor,
  password: string,
  currentPassword: string,
) {
  const hashed = await passwordHash(checkedPassword(password));
  const email = await db.$transaction(async (tx) => {
    const account = await requireRecent(tx, actor, currentPassword);
    await tx.account.update({
      where: { id: actor.id },
      data: { passwordHash: hashed, sessionVersion: { increment: 1 } },
    });
    await tx.accountAuthToken.deleteMany({ where: { accountId: actor.id } });
    await tx.recoveryCode.deleteMany({ where: { accountId: actor.id } });
    return account.recoveryEmail;
  });
  await notifyAccount(
    email,
    "Your Minglo password was changed. Sign in again; previous sessions and backup codes have been invalidated.",
  );
}
export async function createGoogleIntent(
  actor: RecentActor,
  password: string,
  nextPath: string,
) {
  return db.$transaction(async (tx) => {
    const account = await requireRecent(tx, actor, password);
    return issueToken(tx, {
      purpose: "google-link",
      accountId: actor.id,
      sessionVersion: account.sessionVersion,
      nextPath: safeNext(nextPath),
    });
  });
}
// Input comes only from Auth.js's validated Google OIDC callback, never a browser form.
export async function googleProfileProof(
  subject: string,
  input: unknown,
  nextPath: string,
) {
  const email = normalizeEmail(input);
  if (!subject || subject.length > 255 || !allowedAuthEmail(email))
    throw new AccountAuthError(
      "Google sign-in is not available for this account during the trial.",
    );
  return db.$transaction((tx) =>
    issueToken(tx, {
      purpose: "google-profile",
      subject,
      email,
      nextPath: safeNext(nextPath),
    }),
  );
}
export async function linkGoogle(
  actor: RecentActor,
  password: string,
  proofToken: string,
) {
  if (authRollout() === "disabled")
    throw new AccountAuthError("Google linking is unavailable.");
  const proof = await readAuthToken(proofToken, "google-profile");
  if (!proof?.subject || !proof.email || !allowedAuthEmail(proof.email))
    throw new AccountAuthError("Start Google sign-in again.");
  try {
    const email = await db.$transaction(async (tx) => {
      const account = await requireRecent(tx, actor, password);
      await consume(tx, proof.tokenHash);
      await tx.signInIdentity.create({
        data: {
          accountId: actor.id,
          provider: "google",
          subject: proof.subject!,
        },
      });
      return account.recoveryEmail;
    });
    await notifyAccount(
      email,
      "Google sign-in was connected to your Minglo account.",
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AccountAuthError(
        "This Google account or Minglo account is already connected. No accounts were merged.",
      );
    throw error;
  }
}
export async function completeGoogleLink(
  intentToken: string,
  proofToken: string,
  actor: RecentActor,
) {
  const intent = await readAuthToken(intentToken, "google-link");
  if (
    !intent ||
    intent.accountId !== actor.id ||
    intent.sessionVersion !== actor.sessionVersion
  )
    throw new AccountAuthError(
      "Sign in to the account that started linking, then try again.",
    );
  // The intent records the successful recent-auth check made before leaving for Google.
  await linkGoogle(
    { ...actor, authenticatedAt: intent.createdAt.getTime() },
    "",
    proofToken,
  );
  await db.accountAuthToken.deleteMany({
    where: { tokenHash: intent.tokenHash },
  });
}
export async function createGoogleAccount(
  proofToken: string,
  handle: unknown,
  displayName: unknown,
) {
  if (process.env.MINGLO_GOOGLE_SIGNUP_ENABLED !== "true")
    throw new AccountAuthError(
      "New Google registrations are not available yet. Connect an existing account instead.",
    );
  const parsed = z
    .object({
      handle: handleSchema,
      displayName: z.string().trim().min(1).max(60),
    })
    .safeParse({ handle, displayName });
  if (!parsed.success)
    throw new AccountAuthError(parsed.error.issues[0].message);
  const proof = await readAuthToken(proofToken, "google-profile");
  if (!proof?.subject || !proof.email || !allowedAuthEmail(proof.email))
    throw new AccountAuthError("Start Google sign-in again.");
  try {
    return await db.$transaction(async (tx) => {
      await consume(tx, proof.tokenHash);
      // Never auto-link on matching email. Unique constraints also serialize concurrent signup.
      return tx.account.create({
        data: {
          handle: parsed.data.handle,
          type: "OWNER",
          recoveryEmail: proof.email,
          emailVerifiedAt: new Date(),
          owner: { create: { displayName: parsed.data.displayName } },
          tourPreference: { create: {} },
          signInIdentities: {
            create: { provider: "google", subject: proof.subject! },
          },
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AccountAuthError(
        "That handle, email or Google identity is already in use. Sign in to your existing Minglo account to connect Google, or choose another handle.",
      );
    throw error;
  }
}
export async function unlinkGoogle(actor: RecentActor, password: string) {
  const email = await db.$transaction(async (tx) => {
    const account = await requireRecent(tx, actor, password);
    if (!account.passwordHash)
      throw new AccountAuthError(
        "Set a password before disconnecting your only sign-in method.",
      );
    await tx.signInIdentity.deleteMany({
      where: { accountId: actor.id, provider: "google" },
    });
    await tx.account.update({
      where: { id: actor.id },
      data: { sessionVersion: { increment: 1 } },
    });
    await tx.accountAuthToken.deleteMany({ where: { accountId: actor.id } });
    return account.recoveryEmail;
  });
  await notifyAccount(
    email,
    "Google sign-in was disconnected. Sign in with your Minglo password; previous sessions have been invalidated.",
  );
}
