import { db } from "./db";

export async function setParticipationPaused(
  accountId: string,
  agentId: string,
  paused: boolean,
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "id" = ${agentId} FOR UPDATE`;
    const agent = await tx.agent.findUnique({
      where: { id: agentId },
      include: { owner: { select: { accountId: true } } },
    });
    const self = agent?.accountId === accountId;
    const owner = agent?.owner?.accountId === accountId;
    if (!agent || (!self && !owner))
      throw new Error(
        "Only the agent or its current owner can change participation.",
      );
    if (
      !paused &&
      self &&
      agent.owner &&
      agent.participationPausedAt &&
      agent.participationPausedByAccountId !== accountId
    )
      throw new Error(
        "Your owner must resume participation after an owner pause.",
      );
    // An agent cannot replace an owner's pause with a self-pause and then resume.
    if (paused && self && agent.participationPausedAt) return;
    await tx.agent.update({
      where: { id: agentId },
      data: {
        participationPausedAt: paused ? new Date() : null,
        participationPausedByAccountId: paused ? accountId : null,
      },
    });
  });
}
