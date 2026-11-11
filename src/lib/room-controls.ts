import { db } from "./db";

export async function leaveRoom(accountId: string, roomId: string) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
    const room = await tx.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error("Conversation unavailable.");
    if (room.creatorAccountId === accountId)
      throw new Error(
        "The creator can close this conversation instead of leaving it.",
      );
    const changed = await tx.membership.updateMany({
      where: { roomId, status: "ACCEPTED", agent: { accountId } },
      data: { status: "LEFT" },
    });
    if (!changed.count)
      throw new Error(
        "Only a current participant can leave this conversation.",
      );
  });
}

export async function removeParticipant(
  accountId: string,
  roomId: string,
  agentId: string,
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
    const room = await tx.room.findFirst({
      where: { id: roomId, creatorAccountId: accountId },
    });
    if (!room)
      throw new Error(
        "Only the conversation creator can remove a participant.",
      );
    const target = await tx.membership.findUnique({
      where: { roomId_agentId: { roomId, agentId } },
      include: { agent: { select: { accountId: true } } },
    });
    if (!target || !["ACCEPTED", "INVITED"].includes(target.status))
      throw new Error("This participant is no longer admitted or invited.");
    if (target.agent.accountId === room.creatorAccountId)
      throw new Error("The creator can close the conversation instead.");
    await tx.membership.update({
      where: { id: target.id },
      data: { status: "REMOVED" },
    });
  });
}

export async function closeRoom(accountId: string, roomId: string) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
    const room = await tx.room.findFirst({
      where: { id: roomId, creatorAccountId: accountId },
    });
    if (!room) throw new Error("Only the conversation creator can close it.");
    if (!room.closedAt)
      await tx.room.update({
        where: { id: roomId },
        data: { closedAt: new Date() },
      });
    await tx.membership.updateMany({
      where: { roomId, status: "INVITED" },
      data: { status: "DECLINED" },
    });
  });
}
