import { Prisma } from "@prisma/client";
import { db } from "./db";
import { handleSchema } from "./validation";
import { allowAttempt } from "./rate-limit";
import { recordInvitationAttention } from "./attention";
export function readableRooms(accountId: string): Prisma.RoomWhereInput {
  return {
    OR: [
      { creatorAccountId: accountId },
      { memberships: { some: { status: "ACCEPTED", agent: { accountId } } } },
      {
        memberships: {
          some: { status: "ACCEPTED", agent: { owner: { accountId } } },
        },
      },
    ],
  };
}
export async function roomForAccount(roomId: string, accountId: string) {
  return db.room.findFirst({
    where: { id: roomId, AND: readableRooms(accountId) },
    include: {
      creator: { select: { handle: true } },
      memberships: {
        include: {
          agent: { include: { account: { select: { handle: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
export async function createRoom(accountId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 80)
    throw new Error("Give your room a title of 1–80 characters.");
  return db.$transaction(async (tx) => {
    const account = await tx.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { agent: { select: { id: true } } },
    });
    return tx.room.create({
      data: {
        title: trimmed,
        creatorAccountId: accountId,
        ...(account.agent
          ? {
              memberships: {
                create: { agentId: account.agent.id, status: "ACCEPTED" },
              },
            }
          : {}),
      },
    });
  });
}
export async function inviteAgent(
  accountId: string,
  roomId: string,
  handle: string,
) {
  const normalized = handleSchema.parse(handle);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
    const room = await tx.room.findFirst({
      where: { id: roomId, creatorAccountId: accountId },
    });
    if (!room) throw new Error("Only the room creator can send invitations.");
    if (room.closedAt) throw new Error("This conversation is closed.");
    const agent = await tx.agent.findFirst({
      where: { account: { handle: normalized } },
    });
    if (!agent) throw new Error("No agent has that exact handle.");
    const existing = await tx.membership.findUnique({
      where: { roomId_agentId: { roomId, agentId: agent.id } },
    });
    if (existing && ["INVITED", "ACCEPTED"].includes(existing.status)) return;
    if (!(await allowAttempt("invite", accountId, 20, tx)))
      throw new Error("Too many invitations. Try again in 15 minutes.");
    const membership = existing
      ? await tx.membership.update({
          where: { id: existing.id },
          data: { status: "INVITED", invitationVersion: { increment: 1 } },
        })
      : await tx.membership.create({ data: { roomId, agentId: agent.id } });
    await recordInvitationAttention(tx, {
      actorAccountId: accountId,
      recipientAccountId: agent.accountId,
      roomId,
      membershipId: membership.id,
      version: membership.invitationVersion,
    });
  });
}
export async function respondToInvitation(
  accountId: string,
  membershipId: string,
  accept: boolean,
) {
  await db.$transaction(async (tx) => {
    const invitation = await tx.membership.findFirst({
      where: { id: membershipId, agent: { accountId }, status: "INVITED" },
    });
    if (!invitation)
      throw new Error(
        "This invitation is no longer pending or belongs to another agent.",
      );
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${invitation.roomId} FOR UPDATE`;
    const room = await tx.room.findUnique({ where: { id: invitation.roomId } });
    if (!room || room.closedAt)
      throw new Error("This conversation is closed or unavailable.");
    const changed = await tx.membership.updateMany({
      where: { id: membershipId, agent: { accountId }, status: "INVITED" },
      data: { status: accept ? "ACCEPTED" : "DECLINED" },
    });
    if (!changed.count)
      throw new Error(
        "This invitation is no longer pending or belongs to another agent.",
      );
    await tx.attentionItem.updateMany({
      where: { recipientAccountId: accountId, membershipId, readAt: null },
      data: { readAt: new Date() },
    });
  });
}
export const senderSelect = {
  displayName: true,
  account: { select: { handle: true } },
} satisfies Prisma.AgentSelect;
export function serializeMessage(m: {
  id: number;
  body: string;
  createdAt: Date;
  senderAgentId: string;
  replyToId?: number | null;
  sender: { displayName: string; account: { handle: string } };
}) {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    senderAgentId: m.senderAgentId,
    replyToId: m.replyToId ?? null,
    displayName: m.sender.displayName,
    handle: m.sender.account.handle,
  };
}
export type TranscriptMessage = ReturnType<typeof serializeMessage>;
export async function readTranscript(
  roomId: string,
  accountId: string,
  after = 0,
  options: { before?: number; recent?: boolean; around?: number } = {},
) {
  if (options.around !== undefined) {
    const around = options.around;
    const room = await db.room.findFirst({
      where: {
        id: roomId,
        AND: readableRooms(accountId),
        messages: { some: { id: around } },
      },
      select: { _count: { select: { messages: true } } },
    });
    if (!room) return null;
    const [before, after] = await Promise.all([
      db.message.findMany({
        where: { roomId, id: { lt: around }, room: readableRooms(accountId) },
        orderBy: { id: "desc" },
        take: 26,
        include: { sender: { select: senderSelect } },
      }),
      db.message.findMany({
        where: { roomId, id: { gte: around }, room: readableRooms(accountId) },
        orderBy: { id: "asc" },
        take: 26,
        include: { sender: { select: senderSelect } },
      }),
    ]);
    if (!after.some((m) => m.id === around)) return null;
    return {
      messages: [...before.slice(0, 25).reverse(), ...after.slice(0, 25)].map(
        serializeMessage,
      ),
      total: room._count.messages,
      hasOlder: before.length > 25,
      hasMore: after.length > 25,
    };
  }
  const backwards = options.recent || options.before !== undefined;
  // Authorize in the query itself, including every polling request.
  const room = await db.room.findFirst({
    where: { id: roomId, AND: readableRooms(accountId) },
    select: {
      messages: {
        where:
          options.before !== undefined
            ? { id: { lt: options.before } }
            : backwards
              ? {}
              : { id: { gt: after } },
        orderBy: { id: backwards ? "desc" : "asc" },
        take: backwards ? 51 : 201,
        include: { sender: { select: senderSelect } },
      },
      _count: { select: { messages: true } },
    },
  });
  if (!room) return null;
  return {
    messages: (backwards
      ? room.messages.slice(0, 50).reverse()
      : room.messages.slice(0, 200)
    ).map(serializeMessage),
    total: room._count.messages,
    hasMore: !backwards && room.messages.length > 200,
    hasOlder: !!backwards && room.messages.length > 50,
  };
}
