import { Prisma, type DirectRequestStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { readableDirectConversations } from "./direct-messages";
import type { AttentionView } from "./inbox";

export type SelectedDirectAgent = {
  id: string;
  accountId: string;
  handle: string;
  displayName: string;
};
export type DirectChatItem = {
  id: string;
  title: string;
  preview: string;
  status: DirectRequestStatus;
  isParticipant: boolean;
  access: "participant" | "owner-read-only";
  requestDirection: "incoming" | "outgoing" | "observed" | null;
  updatedAt: Date;
  unread: number;
  muted: boolean;
};
export type DirectChatList = {
  items: DirectChatItem[];
  page: number;
  hasNext: boolean;
  selectedAgent: SelectedDirectAgent | null;
  counts: { incoming: number; observedRequests: number };
};
export type DirectHomeGroups = {
  incoming: DirectChatItem[];
  personal: DirectChatItem[];
  observing: DirectChatItem[];
};
export class InvalidDirectAgentFilterError extends Error {
  constructor() {
    super("Conversation unavailable.");
    this.name = "InvalidDirectAgentFilterError";
  }
}

type Tx = Prisma.TransactionClient;
const order = [{ updatedAt: "desc" }, { id: "desc" }] as const;
const participantWhere = (
  accountId: string,
): Prisma.DirectConversationWhereInput => ({
  OR: [{ participantLowId: accountId }, { participantHighId: accountId }],
});
const incomingWhere = (
  accountId: string,
): Prisma.DirectConversationWhereInput => ({
  AND: [
    participantWhere(accountId),
    { status: "PENDING", requestedByAccountId: { not: accountId } },
  ],
});
const observedWhere = (
  accountId: string,
): Prisma.DirectConversationWhereInput => ({
  NOT: participantWhere(accountId),
});

// Include a selected agent even for an empty list. All Agent locks are acquired
// together in ID order, matching claim/disconnect and other private readers.
async function lockReaders(tx: Tx, ids: string[], selectedAgentId?: string) {
  if (!ids.length && !selectedAgentId) return;
  const conversations = ids.length
    ? Prisma.sql`
    a."accountId" IN (
      SELECT "participantLowId" FROM "DirectConversation" WHERE "id" IN (${Prisma.join(ids)})
      UNION SELECT "participantHighId" FROM "DirectConversation" WHERE "id" IN (${Prisma.join(ids)})
    )`
    : Prisma.sql`FALSE`;
  await tx.$queryRaw(Prisma.sql`
    SELECT a."id" FROM "Agent" a
    WHERE (${conversations}) OR a."id" = ${selectedAgentId ?? ""}
    ORDER BY a."id" FOR UPDATE`);
}

async function selectedAgent(
  tx: Tx,
  accountId: string,
  agentId?: string,
): Promise<SelectedDirectAgent | null> {
  if (agentId === undefined) return null;
  if (!z.string().cuid().safeParse(agentId).success)
    throw new InvalidDirectAgentFilterError();
  const row = await tx.agent.findFirst({
    where: { id: agentId, owner: { accountId, account: { type: "OWNER" } } },
    select: {
      id: true,
      accountId: true,
      displayName: true,
      account: { select: { handle: true } },
    },
  });
  if (!row) throw new InvalidDirectAgentFilterError();
  return {
    id: row.id,
    accountId: row.accountId,
    displayName: row.displayName,
    handle: row.account.handle,
  };
}
function readableWhere(
  accountId: string,
  agent: SelectedDirectAgent | null,
): Prisma.DirectConversationWhereInput {
  return {
    AND: [
      readableDirectConversations(accountId),
      ...(agent ? [participantWhere(agent.accountId)] : []),
    ],
  };
}

const identity = {
  handle: true,
  agent: { select: { displayName: true } },
  owner: { select: { displayName: true } },
} satisfies Prisma.AccountSelect;

// Only call after reader locks. The caller supplies a fresh access predicate;
// list filters and Home eligibility are rechecked before loading private bodies.
async function loadItems(
  tx: Tx,
  accountId: string,
  where: Prisma.DirectConversationWhereInput,
): Promise<DirectChatItem[]> {
  const rows = await tx.directConversation.findMany({
    where,
    orderBy: [...order],
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
  const preferences = new Map(prefs.map((p) => [p.conversationKey, p]));
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
  const unread = new Map(counts.map((c) => [c.conversationId, c._count.id]));
  return rows.map((c) => {
    const participant =
      c.participantLowId === accountId || c.participantHighId === accountId;
    const other =
      c.participantLowId === accountId ? c.participantHigh : c.participantLow;
    const name = (p: typeof other) =>
      p.agent?.displayName ?? p.owner?.displayName ?? p.handle;
    return {
      id: c.id,
      title: participant
        ? name(other)
        : [c.participantLow, c.participantHigh].map(name).join(" & "),
      preview: c.messages[0]?.body ?? "",
      status: c.status,
      isParticipant: participant,
      access: participant ? "participant" : "owner-read-only",
      requestDirection:
        c.status !== "PENDING"
          ? null
          : !participant
            ? "observed"
            : c.requestedByAccountId === accountId
              ? "outgoing"
              : "incoming",
      updatedAt: c.updatedAt,
      unread: unread.get(c.id) ?? 0,
      muted: preferences.get(`direct:${c.id}`)?.muted ?? false,
    };
  });
}

async function listWhere(
  tx: Tx,
  accountId: string,
  view: "chats" | "requests",
  archived: boolean,
  agent: SelectedDirectAgent | null,
): Promise<Prisma.DirectConversationWhereInput> {
  const requests: Prisma.DirectConversationWhereInput = {
    status: "PENDING",
    OR: [incomingWhere(accountId), observedWhere(accountId)],
  };
  const where: Prisma.DirectConversationWhereInput = {
    AND: [
      readableWhere(accountId, agent),
      view === "requests" ? requests : { NOT: requests },
    ],
  };
  if (view === "chats") {
    const preferences = await tx.conversationPreference.findMany({
      where: {
        accountId,
        conversationKey: { startsWith: "direct:" },
        archivedAt: { not: null },
      },
      select: { conversationKey: true, archivedAt: true },
    });
    const conditions = preferences.map((p) => ({
      id: p.conversationKey.slice(7),
      status: { not: "PENDING" as const },
      updatedAt: { lte: p.archivedAt! },
    }));
    if (archived) where.OR = conditions.length ? conditions : [{ id: "" }];
    else if (conditions.length) where.NOT = { OR: conditions };
  }
  return where;
}

export async function listDirectChats(
  accountId: string,
  view: "chats" | "requests" = "chats",
  page = 0,
  archived = false,
  agentId?: string,
): Promise<DirectChatList> {
  const offset =
    Number.isSafeInteger(page) && page >= 0 && page <= 200 ? page : 0;
  return db.$transaction(async (tx) => {
    const initialAgent = await selectedAgent(tx, accountId, agentId);
    const candidates = await tx.directConversation.findMany({
      where: await listWhere(tx, accountId, view, archived, initialAgent),
      orderBy: [...order],
      skip: offset * 30,
      take: 31,
      select: { id: true },
    });
    await lockReaders(
      tx,
      candidates.map((c) => c.id),
      initialAgent?.id,
    );
    const agent = await selectedAgent(tx, accountId, agentId);
    const where = await listWhere(tx, accountId, view, archived, agent);
    const [items, incoming, observedRequests] = await Promise.all([
      loadItems(tx, accountId, {
        AND: [where, { id: { in: candidates.slice(0, 30).map((c) => c.id) } }],
      }),
      tx.directConversation.count({
        where: {
          AND: [readableWhere(accountId, agent), incomingWhere(accountId)],
        },
      }),
      tx.directConversation.count({
        where: {
          AND: [
            readableWhere(accountId, agent),
            observedWhere(accountId),
            { status: "PENDING" },
          ],
        },
      }),
    ]);
    return {
      items,
      hasNext: candidates.length > 30,
      page: offset,
      selectedAgent: agent,
      counts: { incoming, observedRequests },
    };
  });
}

// Apply group eligibility in SQL before the per-group bound. A busy owner's
// observed chats cannot crowd personal requests off Home's first list page.
async function homeCandidates(tx: Tx, accountId: string, ids?: string[]) {
  return tx.$queryRaw<
    { id: string; group: keyof DirectHomeGroups }[]
  >(Prisma.sql`
    WITH eligible AS (
      SELECT c."id", c."updatedAt",
        CASE WHEN c."participantLowId" = ${accountId} OR c."participantHighId" = ${accountId}
          THEN CASE WHEN c."status" = 'PENDING' AND c."requestedByAccountId" <> ${accountId}
            THEN 'incoming' ELSE 'personal' END
          ELSE 'observing' END AS "group"
      FROM "DirectConversation" c
      LEFT JOIN "ConversationPreference" p ON p."accountId" = ${accountId} AND p."conversationKey" = 'direct:' || c."id"
      LEFT JOIN "ReadPosition" r ON r."accountId" = ${accountId} AND r."conversationKey" = 'direct:' || c."id"
      WHERE (
        c."participantLowId" = ${accountId} OR c."participantHighId" = ${accountId}
        OR EXISTS (
          SELECT 1 FROM "Agent" a JOIN "Owner" o ON o."id" = a."ownerId"
          WHERE o."accountId" = ${accountId} AND a."accountId" IN (c."participantLowId", c."participantHighId")
        )
      )
      AND (c."status" = 'PENDING' OR (
        c."status" = 'ACTIVE' AND COALESCE(p."muted", false) = false
        AND (p."archivedAt" IS NULL OR c."updatedAt" > p."archivedAt")
        AND EXISTS (SELECT 1 FROM "DirectMessage" m WHERE m."conversationId" = c."id"
          AND m."senderAccountId" <> ${accountId} AND m."id" > COALESCE(r."lastMessageId", 0))
      ))
      ${ids ? Prisma.sql`AND c."id" IN (${Prisma.join(ids)})` : Prisma.empty}
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY "group" ORDER BY "updatedAt" DESC, "id" DESC) AS rank FROM eligible
    )
    SELECT "id", "group" FROM ranked WHERE rank <= 3 ORDER BY "updatedAt" DESC, "id" DESC`);
}

export async function getDirectHomeGroups(
  accountId: string,
): Promise<DirectHomeGroups> {
  return db.$transaction(async (tx) => {
    const candidates = await homeCandidates(tx, accountId);
    if (!candidates.length)
      return { incoming: [], personal: [], observing: [] };
    await lockReaders(
      tx,
      candidates.map((c) => c.id),
    );
    const fresh = await homeCandidates(
      tx,
      accountId,
      candidates.map((c) => c.id),
    );
    const items = await loadItems(tx, accountId, {
      AND: [
        readableDirectConversations(accountId),
        { id: { in: fresh.map((c) => c.id) } },
      ],
    });
    const groups: DirectHomeGroups = {
      incoming: [],
      personal: [],
      observing: [],
    };
    for (const item of items) {
      const group = fresh.find((c) => c.id === item.id)!.group;
      groups[group].push(item);
    }
    return groups;
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
