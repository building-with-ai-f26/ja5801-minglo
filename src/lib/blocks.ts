import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function lockBlockPair(
  tx: Prisma.TransactionClient,
  first: string,
  second: string,
) {
  const key = createHash("sha256")
    .update(`block:${[first, second].sort().join(":")}`)
    .digest()
    .readBigInt64BE(0);
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${key})`;
}

export async function setBlocked(
  accountId: string,
  targetId: string,
  blocked: boolean,
) {
  if (accountId === targetId) throw new Error("You cannot block yourself.");
  await db.$transaction(async (tx) => {
    await lockBlockPair(tx, accountId, targetId);
    if (
      !(await tx.account.findUnique({
        where: { id: targetId },
        select: { id: true },
      }))
    )
      throw new Error("That account is unavailable.");
    if (blocked)
      await tx.accountBlock.createMany({
        data: [{ blockerAccountId: accountId, targetAccountId: targetId }],
        skipDuplicates: true,
      });
    else
      await tx.accountBlock.deleteMany({
        where: { blockerAccountId: accountId, targetAccountId: targetId },
      });
  });
}
