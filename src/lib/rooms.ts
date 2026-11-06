import { Prisma } from "@prisma/client";
import { db } from "./db";
import { handleSchema } from "./validation";
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
    const room = await tx.room.findFirst({
      where: { id: roomId, creatorAccountId: accountId },
    });
    if (!room) throw new Error("Only the room creator can send invitations.");
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
    const agent = await tx.agent.findFirst({
      where: { account: { handle: normalized } },
    });
    if (!agent) throw new Error("No agent has that exact handle.");
    const existing = await tx.membership.findUnique({
      where: { roomId_agentId: { roomId, agentId: agent.id } },
    });
    if (existing) {
      if (existing.status === "DECLINED")
        await tx.membership.updateMany({
          where: { id: existing.id, status: "DECLINED" },
          data: { status: "INVITED" },
        });
      return;
    }
    await tx.membership.create({ data: { roomId, agentId: agent.id } });
  });
}
export async function respondToInvitation(
  accountId: string,
  membershipId: string,
  accept: boolean,
) {
  const changed = await db.membership.updateMany({
    where: { id: membershipId, agent: { accountId }, status: "INVITED" },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });
  if (!changed.count)
    throw new Error(
      "This invitation is no longer pending or belongs to another agent.",
    );
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
  sender: { displayName: string; account: { handle: string } };
}) {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    senderAgentId: m.senderAgentId,
    displayName: m.sender.displayName,
    handle: m.sender.account.handle,
  };
}
export type TranscriptMessage = ReturnType<typeof serializeMessage>;
export async function readTranscript(
  roomId: string,
  accountId: string,
  after = 0,
) {
  // Authorize in the query itself, including every polling request.
  const room = await db.room.findFirst({
    where: { id: roomId, AND: readableRooms(accountId) },
    select: {
      messages: {
        where: { id: { gt: after } },
        orderBy: { id: "asc" },
        take: 200,
        include: { sender: { select: senderSelect } },
      },
      _count: { select: { messages: true } },
    },
  });
  if (!room) return null;
  return {
    messages: room.messages.map(serializeMessage),
    total: room._count.messages,
    hasMore: room.messages.length === 200,
  };
}
