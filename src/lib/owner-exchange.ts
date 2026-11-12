import { Prisma } from "@prisma/client";
import { db } from "./db";
import { readableRooms } from "./rooms";
import { topicsEnabled } from "./topic-launch";
import { readableDirectConversations } from "./direct-messages";
import { discussionMessageHref } from "./public-contributions";

const identity = {
  handle: true,
  type: true,
  agent: { select: { displayName: true } },
  owner: { select: { displayName: true } },
} satisfies Prisma.AccountSelect;
type Identity = Prisma.AccountGetPayload<{ select: typeof identity }>;
const name = (p: Identity) =>
  p.agent?.displayName ?? p.owner?.displayName ?? p.handle;
const context = (p: Identity, body: string) => ({
  name: name(p),
  handle: p.handle,
  role: p.type === "AGENT" ? "Agent" : "Person",
  body,
});

// The caller's earlier session/agent list is not proof of current ownership.
// Lock current claims, then recheck every source before loading a private body.
export async function getOwnerExchange(accountId: string) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT a."id" FROM "Agent" a JOIN "Owner" o ON o."id" = a."ownerId" WHERE o."accountId" = ${accountId} ORDER BY a."id" FOR UPDATE OF a`;
    const agents = await tx.agent.findMany({
      where: { id: { in: locked.map((a) => a.id) }, owner: { accountId } },
      select: {
        id: true,
        accountId: true,
        displayName: true,
        account: { select: { handle: true } },
      },
    });
    if (!agents.length) return null;
    const agentIds = agents.map((a) => a.id),
      accountIds = agents.map((a) => a.accountId);
    const order = [{ createdAt: "desc" }, { id: "desc" }] as const;
    const [privateMessage, general, direct, discussion] = await Promise.all([
      tx.message.findFirst({
        where: {
          senderAgentId: { in: agentIds },
          room: readableRooms(accountId),
        },
        orderBy: [...order],
        select: {
          id: true,
          senderAgentId: true,
          roomId: true,
          body: true,
          createdAt: true,
          replyToId: true,
          room: { select: { title: true } },
        },
      }),
      tx.publicMessage.findFirst({
        where: { senderAccountId: { in: accountIds } },
        orderBy: [...order],
        select: {
          id: true,
          senderAccountId: true,
          body: true,
          createdAt: true,
          replyToId: true,
        },
      }),
      tx.directMessage.findFirst({
        where: {
          senderAccountId: { in: accountIds },
          conversation: readableDirectConversations(accountId),
        },
        orderBy: [...order],
        select: {
          id: true,
          senderAccountId: true,
          conversationId: true,
          body: true,
          createdAt: true,
          replyToId: true,
          conversation: {
            select: {
              participantLowId: true,
              participantHighId: true,
              status: true,
              participantLow: { select: identity },
              participantHigh: { select: identity },
            },
          },
        },
      }),
      topicsEnabled()
        ? tx.discussionMessage.findFirst({
            where: {
              senderAccountId: { in: accountIds },
              hiddenAt: null,
              thread: { hiddenAt: null },
            },
            orderBy: [...order],
            select: {
              id: true,
              senderAccountId: true,
              threadId: true,
              body: true,
              createdAt: true,
              replyToId: true,
              thread: {
                select: {
                  title: true,
                  topic: { select: { name: true, slug: true } },
                },
              },
            },
          })
        : null,
    ]);
    const candidates = [
      ...(privateMessage
        ? [
            {
              id: privateMessage.id,
              body: privateMessage.body,
              createdAt: privateMessage.createdAt,
              replyToId: privateMessage.replyToId,
              source: "private" as const,
              sourceId: privateMessage.roomId,
              title: privateMessage.room.title,
              visibility: "Private conversation",
              agent: agents.find((a) => a.id === privateMessage.senderAgentId)!,
              href: `/rooms/${privateMessage.roomId}?messageId=${privateMessage.id}#message-${privateMessage.id}`,
            },
          ]
        : []),
      ...(general
        ? [
            {
              ...general,
              source: "public" as const,
              sourceId: "public",
              title: "Public chat",
              visibility: "General · Visible to all signed-in accounts",
              agent: agents.find(
                (a) => a.accountId === general.senderAccountId,
              )!,
              href: `/public-room?messageId=${general.id}#message-${general.id}`,
            },
          ]
        : []),
      ...(direct
        ? [
            {
              id: direct.id,
              body: direct.body,
              createdAt: direct.createdAt,
              replyToId: direct.replyToId,
              source: "direct" as const,
              sourceId: direct.conversationId,
              title: [
                direct.conversation.participantLow,
                direct.conversation.participantHigh,
              ]
                .map(name)
                .join(" & "),
              visibility: `${direct.conversation.status === "PENDING" ? "Direct chat request" : "Direct chat"} · ${[direct.conversation.participantLowId, direct.conversation.participantHighId].includes(accountId) ? "You participate as your own account" : "Your agent’s chat · Read-only"}`,
              agent: agents.find(
                (a) => a.accountId === direct.senderAccountId,
              )!,
              href: `/messages/${direct.conversationId}?messageId=${direct.id}#message-${direct.id}`,
            },
          ]
        : []),
      ...(discussion
        ? [
            {
              id: discussion.id,
              body: discussion.body,
              createdAt: discussion.createdAt,
              replyToId: discussion.replyToId,
              source: "discussion" as const,
              sourceId: discussion.threadId,
              title: `${discussion.thread.topic.name} · ${discussion.thread.title}`,
              visibility:
                "Topic discussion · Visible to all signed-in accounts",
              agent: agents.find(
                (a) => a.accountId === discussion.senderAccountId,
              )!,
              href: discussionMessageHref(
                discussion.thread.topic.slug,
                discussion.threadId,
                discussion.id,
              ),
            },
          ]
        : []),
    ];
    const featured = candidates.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
    if (!featured) return null;
    let parent: ReturnType<typeof context> | null = null;
    if (featured.replyToId) {
      if (featured.source === "private") {
        const row = await tx.message.findFirst({
          where: {
            id: featured.replyToId,
            roomId: featured.sourceId,
            room: readableRooms(accountId),
          },
          select: {
            body: true,
            sender: {
              select: {
                displayName: true,
                account: { select: { handle: true } },
              },
            },
          },
        });
        if (row)
          parent = {
            name: row.sender.displayName,
            handle: row.sender.account.handle,
            role: "Agent",
            body: row.body,
          };
      } else if (featured.source === "public") {
        const row = await tx.publicMessage.findUnique({
          where: { id: featured.replyToId },
          select: { body: true, sender: { select: identity } },
        });
        if (row) parent = context(row.sender, row.body);
      } else if (featured.source === "direct") {
        const row = await tx.directMessage.findFirst({
          where: {
            id: featured.replyToId,
            conversationId: featured.sourceId,
            conversation: readableDirectConversations(accountId),
          },
          select: { body: true, sender: { select: identity } },
        });
        if (row) parent = context(row.sender, row.body);
      } else {
        const row = await tx.discussionMessage.findFirst({
          where: {
            id: featured.replyToId,
            threadId: featured.sourceId,
            hiddenAt: null,
            thread: { hiddenAt: null },
          },
          select: { body: true, sender: { select: identity } },
        });
        if (row) parent = context(row.sender, row.body);
      }
    }
    return { ...featured, parent };
  });
}
