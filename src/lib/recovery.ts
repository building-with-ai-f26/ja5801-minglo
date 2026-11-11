import { randomBytes, createHash } from "node:crypto";
import { hash, verify, argon2id } from "argon2";
import { db } from "./db";
import { credentialsSchema } from "./validation";
import { allowAttempt } from "./rate-limit";

export class RecoveryError extends Error {}
const digest = (code: string) =>
  createHash("sha256").update(code).digest("hex");

export async function createRecoveryCodes(accountId: string, password: string) {
  if (password.length < 10 || password.length > 128)
    throw new RecoveryError("Enter your current password.");
  const codes = Array.from({ length: 6 }, () =>
    randomBytes(16).toString("base64url"),
  );
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
    const account = await tx.account.findUnique({
      where: { id: accountId },
      select: { passwordHash: true },
    });
    if (!account || !(await verify(account.passwordHash, password)))
      throw new RecoveryError("The current password could not be verified.");
    await tx.recoveryCode.deleteMany({ where: { accountId } });
    await tx.recoveryCode.createMany({
      data: codes.map((code) => ({ accountId, tokenHash: digest(code) })),
    });
  });
  return codes;
}

export async function recoverAccount(
  handle: string,
  code: string,
  password: string,
  source: string,
) {
  const parsed = credentialsSchema.safeParse({ handle, password });
  if (!parsed.success) throw new RecoveryError(parsed.error.issues[0].message);
  if (
    !(await allowAttempt("recover-source", source, 20)) ||
    !(await allowAttempt("recover-pair", `${source}:${parsed.data.handle}`, 5))
  )
    throw new RecoveryError(
      "Too many recovery attempts. Try again in 15 minutes.",
    );
  if (!/^[A-Za-z0-9_-]{22}$/.test(code))
    throw new RecoveryError(
      "The handle and recovery code could not be verified.",
    );
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "handle" = ${parsed.data.handle} FOR UPDATE`;
    const account = await tx.account.findUnique({
      where: { handle: parsed.data.handle },
      select: { id: true },
    });
    const recovery = account
      ? await tx.recoveryCode.findFirst({
          where: {
            accountId: account.id,
            tokenHash: digest(code),
            usedAt: null,
          },
        })
      : null;
    if (!account || !recovery)
      throw new RecoveryError(
        "The handle and recovery code could not be verified.",
      );
    const passwordHash = await hash(parsed.data.password, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await tx.recoveryCode.updateMany({
      where: { accountId: account.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.account.update({
      where: { id: account.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
        lastActiveAt: new Date(),
      },
    });
  });
}
