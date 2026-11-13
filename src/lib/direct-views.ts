import { Prisma, type DirectRequestStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { readableDirectConversations } from "./direct-messages";
import { readableRooms } from "./rooms";
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
export type RoomChatItem = {
  kind: "room";
  id: string;
  title: string;
  preview: string;
  updatedAt: Date;
  unread: number;
  muted: boolean;
  closed: boolean;
  access: "participant" | "creator-read-only" | "owner-read-only";
};
export type MessageChatItem =
  (DirectChatItem & { kind: "direct" }) | RoomChatItem;
export type MessageChatList = Omit<DirectChatList, "items"> & {
  items: MessageChatItem[];
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
async function lockReaders(
  tx: Tx,
  ids: string[],
  selectedAgentId?: string,
  roomIds: string[] = [],
) {
  if (!ids.length && !selectedAgentId && !roomIds.length) return;
  const conversations = ids.length
    ? Prisma.sql`
    a."accountId" IN (
      SELECT "participantLowId" FROM "DirectConversation" WHERE "id" IN (${Prisma.join(ids)})
      UNION SELECT "participantHighId" FROM "DirectConversation" WHERE "id" IN (${Prisma.join(ids)})
    )`
    : Prisma.sql`FALSE`;
  const roomMembers = roomIds.length
    ? Prisma.sql`EXISTS (SELECT 1 FROM "Membership" m WHERE m."agentId" = a."id" AND m."roomId" IN (${Prisma.join(roomIds)}))`
    : Prisma.sql`FALSE`;
  await tx.$queryRaw(Prisma.sql`
    SELECT a."id" FROM "Agent" a
    WHERE (${conversations}) OR (${roomMembers}) OR a."id" = ${selectedAgentId ?? ""}
    ORDER BY a."id" FOR UPDATE`);
}

async function requestCounts(
  tx: Tx,
  accountId: string,
  agent: SelectedDirectAgent | null,
) {
  const [incoming, observedRequests] = await Promise.all([
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
  return { incoming, observedRequests };
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
    const [items, counts] = await Promise.all([
      loadItems(tx, accountId, {
        AND: [where, { id: { in: candidates.slice(0, 30).map((c) => c.id) } }],
      }),
      requestCounts(tx, accountId, agent),
    ]);
    return {
      items,
      hasNext: candidates.length > 30,
      page: offset,
      selectedAgent: agent,
      counts,
    };
  });
}

function roomAgentFilter(
  agent: SelectedDirectAgent | null,
): Prisma.RoomWhereInput {
  return agent
    ? {
        OR: [
          { creatorAccountId: agent.accountId },
          { memberships: { some: { agentId: agent.id, status: "ACCEPTED" } } },
        ],
      }
    : {};
}

async function roomCandidates(
  tx: Tx,
  accountId: string,
  agent: SelectedDirectAgent | null,
  take: number,
) {
  return tx.$queryRaw<{ id: string; updatedAt: Date }[]>(Prisma.sql`
    SELECT r."id", COALESCE(latest."createdAt", r."createdAt") AS "updatedAt"
    FROM "Room" r
    LEFT JOIN LATERAL (
      SELECT m."createdAt" FROM "Message" m WHERE m."roomId" = r."id" ORDER BY m."id" DESC LIMIT 1
    ) latest ON true
    WHERE (r."creatorAccountId" = ${accountId} OR EXISTS (
      SELECT 1 FROM "Membership" m JOIN "Agent" a ON a."id" = m."agentId"
      LEFT JOIN "Owner" o ON o."id" = a."ownerId"
      WHERE m."roomId" = r."id" AND m."status" = 'ACCEPTED'
        AND (a."accountId" = ${accountId} OR o."accountId" = ${accountId})
    ))
    ${
      agent
        ? Prisma.sql`AND (r."creatorAccountId" = ${agent.accountId} OR EXISTS (
      SELECT 1 FROM "Membership" m WHERE m."roomId" = r."id"
        AND m."agentId" = ${agent.id} AND m."status" = 'ACCEPTED'
    ))`
        : Prisma.empty
    }
    ORDER BY "updatedAt" DESC, r."id" DESC LIMIT ${take}
  `);
}

async function loadRoomItems(
  tx: Tx,
  accountId: string,
  agent: SelectedDirectAgent | null,
  ids: string[],
): Promise<RoomChatItem[]> {
  if (!ids.length) return [];
  // Candidate IDs are never enough authority to load a private preview. Recheck
  // current room membership, ownership and selected-agent scope after locks.
  const rooms = await tx.room.findMany({
    where: {
      AND: [
        { id: { in: ids } },
        readableRooms(accountId),
        roomAgentFilter(agent),
      ],
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      closedAt: true,
      creatorAccountId: true,
      memberships: {
        where: { status: "ACCEPTED", agent: { accountId } },
        select: { id: true },
      },
      messages: {
        orderBy: { id: "desc" },
        take: 1,
        select: { id: true, body: true, createdAt: true },
      },
    },
  });
  const keys = rooms.map((r) => `private:${r.id}`);
  const [positions, preferences] = await Promise.all([
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
  const counts = rooms.length
    ? await tx.message.groupBy({
        by: ["roomId"],
        where: {
          sender: { accountId: { not: accountId } },
          OR: rooms.map((r) => ({
            roomId: r.id,
            id: { gt: cursors.get(`private:${r.id}`) ?? 0 },
          })),
        },
        _count: { id: true },
      })
    : [];
  const unread = new Map(counts.map((c) => [c.roomId, c._count.id]));
  return rooms.map((r) => ({
    kind: "room",
    id: r.id,
    title: r.title,
    preview: r.messages[0]?.body ?? "No messages yet.",
    updatedAt: r.messages[0]?.createdAt ?? r.createdAt,
    closed: !!r.closedAt,
    unread: unread.get(r.id) ?? 0,
    muted:
      preferences.find((p) => p.conversationKey === `private:${r.id}`)?.muted ??
      false,
    access: r.memberships.length
      ? "participant"
      : r.creatorAccountId === accountId
        ? "creator-read-only"
        : "owner-read-only",
  }));
}

/** Messages combines direct chats and existing agent rooms on one shared page. */
export async function listMessageChats(
  accountId: string,
  view: "chats" | "requests" = "chats",
  page = 0,
  archived = false,
  agentId?: string,
): Promise<MessageChatList> {
  // Requests and archive remain direct-chat workflows. Room invitations retain
  // their existing separate admission flow, and rooms gain no archive mutation.
  if (view === "requests" || archived) {
    const direct = await listDirectChats(
      accountId,
      view,
      page,
      archived,
      agentId,
    );
    return {
      ...direct,
      items: direct.items.map((c) => ({ ...c, kind: "direct" as const })),
    };
  }
  const offset =
    Number.isSafeInteger(page) && page >= 0 && page <= 200 ? page : 0;
  return db.$transaction(async (tx) => {
    const initialAgent = await selectedAgent(tx, accountId, agentId);
    // Only bounded ID/timestamp prefixes are merged, never entire transcripts.
    // A global prefix cannot need more than this prefix from either source.
    const take = offset * 30 + 31;
    const [direct, rooms] = await Promise.all([
      tx.directConversation.findMany({
        where: await listWhere(tx, accountId, "chats", false, initialAgent),
        orderBy: [...order],
        take,
        select: { id: true, updatedAt: true },
      }),
      roomCandidates(tx, accountId, initialAgent, take),
    ]);
    const candidates = [
      ...direct.map((c) => ({ ...c, kind: "direct" as const })),
      ...rooms.map((c) => ({ ...c, kind: "room" as const })),
    ].sort(
      (a, b) =>
        b.updatedAt.getTime() - a.updatedAt.getTime() ||
        b.id.localeCompare(a.id) ||
        b.kind.localeCompare(a.kind),
    );
    const chosen = candidates.slice(offset * 30, offset * 30 + 30);
    const directIds = chosen
      .filter((c) => c.kind === "direct")
      .map((c) => c.id);
    const roomIds = chosen.filter((c) => c.kind === "room").map((c) => c.id);
    // Room writers lock Room before Agent. Use the same order, then acquire all
    // direct/room reader Agent locks together in ID order before rechecking.
    if (roomIds.length)
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Room" WHERE "id" IN (${Prisma.join(roomIds)}) ORDER BY "id" FOR UPDATE`,
      );
    await lockReaders(tx, directIds, initialAgent?.id, roomIds);
    const agent = await selectedAgent(tx, accountId, agentId);
    const [directItems, roomItems, counts] = await Promise.all([
      loadItems(tx, accountId, {
        AND: [
          await listWhere(tx, accountId, "chats", false, agent),
          { id: { in: directIds } },
        ],
      }),
      loadRoomItems(tx, accountId, agent, roomIds),
      requestCounts(tx, accountId, agent),
    ]);
    const byKey = new Map<string, MessageChatItem>([
      ...directItems.map(
        (c) => [`direct:${c.id}`, { ...c, kind: "direct" as const }] as const,
      ),
      ...roomItems.map((c) => [`room:${c.id}`, c] as const),
    ]);
    return {
      items: chosen.flatMap((c) => {
        const item = byKey.get(`${c.kind}:${c.id}`);
        return item ? [item] : [];
      }),
      page: offset,
      hasNext: candidates.length > offset * 30 + 30,
      selectedAgent: agent,
      counts,
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
