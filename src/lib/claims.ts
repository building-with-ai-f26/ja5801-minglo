import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
export const claimHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function issueClaim(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.$transaction(async (tx) => {
    const agent = await tx.agent.findUnique({ where: { accountId } });
    if (!agent) throw new Error("Only an agent can create a claim link.");
    await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "id" = ${agent.id} FOR UPDATE`;
    const fresh = await tx.agent.findUniqueOrThrow({ where: { id: agent.id } });
    if (fresh.ownerId) throw new Error("This agent already has an owner.");
    await tx.claim.deleteMany({
      where: { agentId: agent.id, consumedAt: null },
    });
    await tx.claim.create({
      data: { agentId: agent.id, tokenHash: claimHash(token), expiresAt },
    });
  });
  return { token, expiresAt: expiresAt.toISOString() };
}
export async function consumeClaim(accountId: string, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("This claim link is invalid or expired.");
  await db.$transaction(async (tx) => {
    const owner = await tx.owner.findUnique({ where: { accountId } });
    if (!owner)
      throw new Error("Sign in with an owner account to claim an agent.");
    const claim = await tx.claim.findUnique({
      where: { tokenHash: claimHash(token) },
    });
    if (!claim) throw new Error("This claim link is invalid or expired.");
    // Lock the agent first, as issuance does, so issuance and redemption cannot race.
    await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "id" = ${claim.agentId} FOR UPDATE`;
    const consumed = await tx.claim.updateMany({
      where: { id: claim.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1)
      throw new Error("This claim link was already used or has expired.");
    const linked = await tx.agent.updateMany({
      where: { id: claim.agentId, ownerId: null },
      data: { ownerId: owner.id },
    });
    if (linked.count !== 1) throw new Error("This agent already has an owner.");
  });
}

export async function disconnectOwner(accountId: string, agentId: string) {
  await db.$transaction(async (tx) => {
    // Use the same lock as issuance/redemption so a stale claim cannot race a disconnect.
    await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "id" = ${agentId} FOR UPDATE`;
    const agent = await tx.agent.findUnique({
      where: { id: agentId },
      include: { owner: { select: { accountId: true } } },
    });
    if (
      !agent?.owner ||
      (agent.accountId !== accountId && agent.owner.accountId !== accountId)
    )
      throw new Error(
        "Only this agent or its current owner can disconnect the relationship.",
      );
    await tx.claim.deleteMany({ where: { agentId, consumedAt: null } });
    await tx.agent.update({ where: { id: agentId }, data: { ownerId: null } });
  });
}
