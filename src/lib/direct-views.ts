import { Prisma } from "@prisma/client";
import { db } from "./db";
import { readableDirectConversations } from "./direct-messages";
import type { AttentionView } from "./inbox";

// Batch-lock the current Agent readers before loading any private preview body.
// No pair or conversation locks are needed: this read never changes a chat.
async function lockReaders(tx: Prisma.TransactionClient, ids: string[]) {
  if (!ids.length) return;
  await tx.$queryRaw(Prisma.sql`
    SELECT a."id" FROM "Agent" a WHERE a."accountId" IN (
      SELECT "participantLowId" FROM "DirectConversation" WHERE "id" IN (${Prisma.join(ids)})
      UNION SELECT "participantHighId" FROM "DirectConversation" WHERE "id" IN (${Prisma.join(ids)})
    ) ORDER BY a."id" FOR UPDATE`);
}

export async function listDirectChats(
  accountId: string,
  view: "chats" | "requests" = "chats",
  page = 0,
  archived = false,
) {
  const offset =
    Number.isSafeInteger(page) && page >= 0 && page <= 200 ? page : 0;
  return db.$transaction(async (tx) => {
    const incoming: Prisma.DirectConversationWhereInput = {
      status: "PENDING",
      requestedByAccountId: { not: accountId },
    };
    const where: Prisma.DirectConversationWhereInput = {
      AND: [
        readableDirectConversations(accountId),
        view === "requests" ? incoming : { NOT: incoming },
      ],
    };
    // Filter archive state in SQL so archived rows cannot crowd out active chats.
    const preferences = await tx.conversationPreference.findMany({
      where: {
        accountId,
        conversationKey: { startsWith: "direct:" },
        archivedAt: { not: null },
      },
      select: { conversationKey: true, archivedAt: true },
    });
    const archivedConditions = preferences.map((p) => ({
      id: p.conversationKey.slice(7),
      status: { not: "PENDING" as const },
      updatedAt: { lte: p.archivedAt! },
    }));
    if (view === "chats") {
      if (archived)
        where.OR = archivedConditions.length
          ? archivedConditions
          : [{ id: "" }];
      else if (archivedConditions.length)
        where.NOT = { OR: archivedConditions };
    }
    const candidates = await tx.directConversation.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: offset * 30,
      take: 31,
      select: { id: true },
    });
    await lockReaders(
      tx,
      candidates.map((c) => c.id),
    );
    const identity = {
      handle: true,
      agent: { select: { displayName: true } },
      owner: { select: { displayName: true } },
    };
    const rows = await tx.directConversation.findMany({
      where: {
        id: { in: candidates.slice(0, 30).map((c) => c.id) },
        AND: readableDirectConversations(accountId),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: {
        participantLow: { select: identity },
        participantHigh: { select: identity },
        messages: {
          orderBy: { id: "desc" },
          take: 1,
          select: { id: true, body: true },
        },
      },
    });
    const keys = rows.map((c) => `direct:${c.id}`);
    const [positions, prefs] = await Promise.all([
      tx.readPosition.findMany({
        where: { accountId, conversationKey: { in: keys } },
      }),
      tx.conversationPreference.findMany({
        where: { accountId, conversationKey: { in: keys } },
      }),
    ]);
    const cursors = new Map(
      positions.map((p) => [p.conversationKey, p.lastMessageId]),
    );
    const counts = rows.length
      ? await tx.directMessage.groupBy({
          by: ["conversationId"],
          where: {
            senderAccountId: { not: accountId },
            OR: rows.map((c) => ({
              conversationId: c.id,
              id: { gt: cursors.get(`direct:${c.id}`) ?? 0 },
            })),
          },
          _count: { id: true },
        })
      : [];
    return {
      hasNext: candidates.length > 30,
      page: offset,
      items: rows.map((c) => {
        const participant =
          c.participantLowId === accountId || c.participantHighId === accountId;
        const people = [c.participantLow, c.participantHigh];
        const other =
          c.participantLowId === accountId
            ? c.participantHigh
            : c.participantLow;
        const name = (p: typeof other) =>
          p.agent?.displayName ?? p.owner?.displayName ?? p.handle;
        return {
          id: c.id,
          title: participant ? name(other) : people.map(name).join(" & "),
          preview: c.messages[0]?.body ?? "",
          status: c.status,
          isParticipant: participant,
          updatedAt: c.updatedAt,
          unread: counts.find((n) => n.conversationId === c.id)?._count.id ?? 0,
          muted:
            prefs.find((p) => p.conversationKey === `direct:${c.id}`)?.muted ??
            false,
        };
      }),
    };
  });
}

export async function getDirectAttention(
  accountId: string,
): Promise<AttentionView[]> {
  return db.$transaction(async (tx) => {
    const rows = await tx.attentionItem.findMany({
      where: {
        recipientAccountId: accountId,
        readAt: null,
        kind: { in: ["DIRECT_REQUEST", "DIRECT_MESSAGE"] },
        directConversation: readableDirectConversations(accountId),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      include: { actor: { select: { handle: true } } },
    });
    await lockReaders(
      tx,
      rows.flatMap((r) =>
        r.directConversationId ? [r.directConversationId] : [],
      ),
    );
    const [messages, preferences, blocks] = await Promise.all([
      tx.directMessage.findMany({
        where: {
          id: { in: rows.flatMap((r) => (r.messageId ? [r.messageId] : [])) },
          conversation: readableDirectConversations(accountId),
        },
        include: {
          conversation: {
            select: { id: true, status: true, requestVersion: true },
          },
        },
      }),
      tx.conversationPreference.findMany({ where: { accountId, muted: true } }),
      tx.accountBlock.findMany({
        where: {
          OR: [{ blockerAccountId: accountId }, { targetAccountId: accountId }],
        },
      }),
    ]);
    return rows.flatMap<AttentionView>((row) => {
      const m = messages.find(
        (m) =>
          m.id === row.messageId &&
          m.conversationId === row.directConversationId &&
          row.conversationKey === `direct:${m.conversationId}`,
      );
      if (
        !m ||
        blocks.some(
          (b) =>
            b.blockerAccountId === row.actorAccountId ||
            b.targetAccountId === row.actorAccountId,
        )
      )
        return [];
      const request = row.kind === "DIRECT_REQUEST";
      if (
        request &&
        (m.conversation.status !== "PENDING" ||
          m.conversation.requestVersion !== row.requestVersion)
      )
        return [];
      if (
        !request &&
        preferences.some((p) => p.conversationKey === row.conversationKey)
      )
        return [];
      return [
        {
          id: row.id,
          kind: row.kind as "DIRECT_REQUEST" | "DIRECT_MESSAGE",
          title: `@${row.actor.handle} ${request ? "sent a chat request" : "sent a message"}`,
          preview: m.body,
          href: `/messages/${m.conversationId}?messageId=${m.id}#message-${m.id}`,
          createdAt: row.createdAt,
        },
      ];
    });
  });
}
