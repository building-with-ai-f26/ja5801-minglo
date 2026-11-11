import { db } from "./db";
import { readableRooms } from "./rooms";

export type InboxItem = {
  key: string;
  title: string;
  href: string;
  preview: string;
  unread: number;
  updatedAt: Date;
};

export async function getInbox(accountId: string): Promise<InboxItem[]> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { agent: { select: { id: true } } },
  });
  if (!account) return [];
  const [rooms, positions] = await Promise.all([
    db.room.findMany({
      where: readableRooms(accountId),
      select: { id: true, title: true },
    }),
    db.readPosition.findMany({ where: { accountId } }),
  ]);
  const cursors = new Map(
    positions.map((p) => [p.conversationKey, p.lastMessageId]),
  );
  const groups = rooms.length
    ? await db.message.groupBy({
        by: ["roomId"],
        where: {
          room: readableRooms(accountId),
          ...(account.agent
            ? { senderAgentId: { not: account.agent.id } }
            : {}),
          OR: rooms.map((r) => ({
            roomId: r.id,
            id: { gt: cursors.get(`private:${r.id}`) ?? 0 },
          })),
        },
        _count: { id: true },
        _max: { id: true },
      })
    : [];
  const messages = await db.message.findMany({
    where: {
      id: { in: groups.flatMap((g) => (g._max.id ? [g._max.id] : [])) },
      room: readableRooms(accountId),
    },
    select: {
      roomId: true,
      body: true,
      createdAt: true,
      sender: { select: { displayName: true } },
    },
  });
  const titles = new Map(rooms.map((r) => [r.id, r.title]));
  const counts = new Map(groups.map((g) => [g.roomId, g._count.id]));
  const items: InboxItem[] = messages.map((m) => ({
    key: `private:${m.roomId}`,
    title: titles.get(m.roomId) ?? "Private conversation",
    href: `/rooms/${m.roomId}`,
    preview: `${m.sender.displayName}: ${m.body}`,
    unread: counts.get(m.roomId) ?? 0,
    updatedAt: m.createdAt,
  }));
  const publicWhere = {
    id: { gt: cursors.get("public") ?? 0 },
    senderAccountId: { not: accountId },
  };
  const [publicCount, publicLatest] = await Promise.all([
    db.publicMessage.count({ where: publicWhere }),
    db.publicMessage.findFirst({
      where: publicWhere,
      orderBy: { id: "desc" },
      select: { body: true, createdAt: true },
    }),
  ]);
  if (publicLatest)
    items.push({
      key: "public",
      title: "Welcome lounge",
      href: "/public-room",
      preview: publicLatest.body,
      unread: publicCount,
      updatedAt: publicLatest.createdAt,
    });
  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function markConversationRead(
  accountId: string,
  conversationKey: string,
  lastMessageId: number,
) {
  if (!Number.isSafeInteger(lastMessageId) || lastMessageId < 1)
    throw new Error("Invalid reading position.");
  await db.$transaction(async (tx) => {
    let allowed = false;
    if (conversationKey === "public") {
      allowed =
        !!(await tx.account.findUnique({
          where: { id: accountId },
          select: { id: true },
        })) &&
        !!(await tx.publicMessage.findUnique({
          where: { id: lastMessageId },
          select: { id: true },
        }));
    } else if (conversationKey.startsWith("private:")) {
      const roomId = conversationKey.slice(8);
      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
      allowed = !!(await tx.message.findFirst({
        where: { id: lastMessageId, roomId, room: readableRooms(accountId) },
        select: { id: true },
      }));
    }
    if (!allowed) throw new Error("Conversation or message unavailable.");
    // Stale acknowledgments from another tab must never move a cursor backwards.
    await tx.$executeRaw`
      INSERT INTO "ReadPosition" ("accountId", "conversationKey", "lastMessageId")
      VALUES (${accountId}, ${conversationKey}, ${lastMessageId})
      ON CONFLICT ("accountId", "conversationKey") DO UPDATE
      SET "lastMessageId" = GREATEST("ReadPosition"."lastMessageId", EXCLUDED."lastMessageId"), "updatedAt" = NOW()`;
  });
}
