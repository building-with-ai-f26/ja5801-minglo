import { db } from "./db";
import { readableRooms } from "./rooms";
import { markDirectConversationRead } from "./direct-messages";
import { getDirectAttention } from "./direct-views";
import { parseConversationKey } from "./conversation-key";

export type InboxItem = {
  key: string;
  title: string;
  href: string;
  preview: string;
  unread: number;
  updatedAt: Date;
};

export type AttentionView = {
  id: string;
  kind:
    | "REPLY"
    | "MENTION"
    | "INVITATION"
    | "CONVERSATION_UPDATE"
    | "DIRECT_REQUEST"
    | "DIRECT_MESSAGE";
  title: string;
  preview: string;
  href: string;
  createdAt: Date;
};

export async function getAttention(
  accountId: string,
): Promise<AttentionView[]> {
  const [rooms, muted, blocks] = await Promise.all([
    db.room.findMany({
      where: readableRooms(accountId),
      select: { id: true },
    }),
    db.conversationPreference.findMany({
      where: { accountId, muted: true },
      select: { conversationKey: true },
    }),
    db.accountBlock.findMany({
      where: {
        OR: [{ blockerAccountId: accountId }, { targetAccountId: accountId }],
      },
      select: { blockerAccountId: true, targetAccountId: true },
    }),
  ]);
  const rows = await db.attentionItem.findMany({
    where: {
      recipientAccountId: accountId,
      actorAccountId: {
        notIn: blocks.map((b) =>
          b.blockerAccountId === accountId
            ? b.targetAccountId
            : b.blockerAccountId,
        ),
      },
      readAt: null,
      OR: [
        {
          kind: "INVITATION",
          membership: { status: "INVITED", agent: { accountId } },
        },
        {
          kind: { in: ["REPLY", "MENTION", "CONVERSATION_UPDATE"] },
          conversationKey: {
            in: ["public", ...rooms.map((r) => `private:${r.id}`)],
            notIn: muted.map((p) => p.conversationKey),
          },
        },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    include: { actor: { select: { handle: true } } },
  });
  const [privateMessages, publicMessages, invitations] = await Promise.all([
    db.message.findMany({
      where: {
        id: {
          in: rows
            .filter((r) => r.conversationKey.startsWith("private:"))
            .flatMap((r) => (r.messageId === null ? [] : [r.messageId])),
        },
        room: readableRooms(accountId),
      },
      select: { id: true, roomId: true, body: true },
    }),
    db.publicMessage.findMany({
      where: {
        id: {
          in: rows
            .filter((r) => r.conversationKey === "public")
            .flatMap((r) => (r.messageId === null ? [] : [r.messageId])),
        },
      },
      select: { id: true, body: true },
    }),
    db.membership.findMany({
      where: {
        id: {
          in: rows.flatMap((r) => (r.membershipId ? [r.membershipId] : [])),
        },
        agent: { accountId },
        status: "INVITED",
        room: { closedAt: null },
      },
      select: { id: true, roomId: true, room: { select: { title: true } } },
    }),
  ]);
  const privateById = new Map(privateMessages.map((m) => [m.id, m]));
  const publicById = new Map(publicMessages.map((m) => [m.id, m]));
  const invitationById = new Map(invitations.map((m) => [m.id, m]));
  const legacy = rows.flatMap<AttentionView>((row) => {
    if (row.kind === "DIRECT_REQUEST" || row.kind === "DIRECT_MESSAGE")
      return [];
    if (row.kind === "INVITATION") {
      const invitation = row.membershipId
        ? invitationById.get(row.membershipId)
        : null;
      return invitation
        ? [
            {
              id: row.id,
              kind: row.kind,
              title: `Invitation from @${row.actor.handle}`,
              preview: invitation.room.title,
              href: "/inbox?view=requests",
              createdAt: row.createdAt,
            },
          ]
        : [];
    }
    const message =
      row.messageId === null
        ? null
        : row.conversationKey === "public"
          ? publicById.get(row.messageId)
          : privateById.get(row.messageId);
    if (
      !message ||
      ("roomId" in message &&
        row.conversationKey !== `private:${message.roomId}`)
    )
      return [];
    const path =
      row.conversationKey === "public"
        ? "/public-room"
        : `/rooms/${row.conversationKey.slice(8)}`;
    return [
      {
        id: row.id,
        kind: row.kind,
        title: `@${row.actor.handle} ${row.kind === "REPLY" ? "replied to you" : row.kind === "MENTION" ? "mentioned you" : "posted in a conversation you follow"}`,
        preview: message.body,
        href: `${path}?messageId=${message.id}#message-${message.id}`,
        createdAt: row.createdAt,
      },
    ];
  });
  return [...legacy, ...(await getDirectAttention(accountId))]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 100);
}

export async function getInbox(accountId: string): Promise<InboxItem[]> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { agent: { select: { id: true } } },
  });
  if (!account) return [];
  const [rooms, positions, muted] = await Promise.all([
    db.room.findMany({
      where: readableRooms(accountId),
      select: { id: true, title: true },
    }),
    db.readPosition.findMany({ where: { accountId } }),
    db.conversationPreference.findMany({
      where: { accountId, muted: true },
      select: { conversationKey: true },
    }),
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
      title: "Public chat",
      href: "/public-room",
      preview: publicLatest.body,
      unread: publicCount,
      updatedAt: publicLatest.createdAt,
    });
  const mutedKeys = new Set(muted.map((p) => p.conversationKey));
  return items
    .filter((item) => !mutedKeys.has(item.key))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function markConversationRead(
  accountId: string,
  conversationKey: string,
  lastMessageId: number,
) {
  if (!Number.isSafeInteger(lastMessageId) || lastMessageId < 1)
    throw new Error("Invalid reading position.");
  const target = parseConversationKey(conversationKey);
  if (!target) throw new Error("Conversation or message unavailable.");
  if (target.kind === "direct")
    return markDirectConversationRead(accountId, target.id, lastMessageId);
  await db.$transaction(async (tx) => {
    let allowed = false;
    if (target.kind === "public") {
      allowed =
        !!(await tx.account.findUnique({
          where: { id: accountId },
          select: { id: true },
        })) &&
        !!(await tx.publicMessage.findUnique({
          where: { id: lastMessageId },
          select: { id: true },
        }));
    } else if (target.kind === "private") {
      const roomId = target.id;
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
    await tx.attentionItem.updateMany({
      where: {
        recipientAccountId: accountId,
        conversationKey,
        messageId: { lte: lastMessageId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  });
}
