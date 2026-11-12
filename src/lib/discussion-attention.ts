import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { MessageError } from "./messages";
import type { AttentionView, InboxItem } from "./inbox";
import { discussionPath } from "./discussion-path";
import { topicsEnabled } from "./topic-launch";

export async function recordDiscussionAttention(
  tx: Prisma.TransactionClient,
  input: {
    actorAccountId: string;
    threadId: string;
    messageId: number;
    body: string;
    replyToId?: number;
  },
) {
  const handles = [
    ...new Set(
      [
        ...input.body.matchAll(
          /(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,30})(?![a-zA-Z0-9_])/g,
        ),
      ].map((m) => m[1].toLowerCase()),
    ),
  ];
  if (handles.length > 10)
    throw new MessageError("Mention at most 10 accounts per message.", 400);
  const parent = input.replyToId
    ? await tx.discussionMessage.findFirst({
        where: {
          id: input.replyToId,
          threadId: input.threadId,
          hiddenAt: null,
        },
        select: { senderAccountId: true },
      })
    : null;
  const conversationKey = `discussion:${input.threadId}`;
  const prefs = await tx.conversationPreference.findMany({
    where: { conversationKey },
  });
  const subscribers = prefs
    .filter((p) => p.subscribed && !p.muted)
    .map((p) => p.accountId);
  const accounts = await tx.account.findMany({
    where: {
      id: { not: input.actorAccountId },
      OR: [
        { handle: { in: handles } },
        { id: { in: subscribers } },
        ...(parent ? [{ id: parent.senderAccountId }] : []),
      ],
    },
    select: { id: true, handle: true },
  });
  const blocks = await tx.accountBlock.findMany({
    where: {
      OR: [
        {
          blockerAccountId: input.actorAccountId,
          targetAccountId: { in: accounts.map((a) => a.id) },
        },
        {
          targetAccountId: input.actorAccountId,
          blockerAccountId: { in: accounts.map((a) => a.id) },
        },
      ],
    },
  });
  const blocked = new Set(
    blocks.map((b) =>
      b.blockerAccountId === input.actorAccountId
        ? b.targetAccountId
        : b.blockerAccountId,
    ),
  );
  const muted = new Set(prefs.filter((p) => p.muted).map((p) => p.accountId));
  await tx.attentionItem.createMany({
    data: accounts
      .filter((a) => !blocked.has(a.id) && !muted.has(a.id))
      .map((a) => ({
        actorAccountId: input.actorAccountId,
        recipientAccountId: a.id,
        conversationKey,
        kind:
          a.id === parent?.senderAccountId
            ? ("REPLY" as const)
            : handles.includes(a.handle)
              ? ("MENTION" as const)
              : ("CONVERSATION_UPDATE" as const),
        messageId: input.messageId,
        sourceKey: `discussion-message:${input.threadId}:${input.messageId}`,
      })),
    skipDuplicates: true,
  });
}

export async function getDiscussionAttention(
  accountId: string,
): Promise<AttentionView[]> {
  if (!topicsEnabled()) return [];
  return db.$transaction(
    async (tx) => {
      const [prefs, blocks] = await Promise.all([
        tx.conversationPreference.findMany({
          where: { accountId, muted: true },
        }),
        tx.accountBlock.findMany({
          where: {
            OR: [
              { blockerAccountId: accountId },
              { targetAccountId: accountId },
            ],
          },
        }),
      ]);
      const rows = await tx.attentionItem.findMany({
        where: {
          recipientAccountId: accountId,
          readAt: null,
          kind: { in: ["REPLY", "MENTION", "CONVERSATION_UPDATE"] },
          conversationKey: {
            startsWith: "discussion:",
            notIn: prefs.map((p) => p.conversationKey),
          },
          actorAccountId: {
            notIn: blocks.map((b) =>
              b.blockerAccountId === accountId
                ? b.targetAccountId
                : b.blockerAccountId,
            ),
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
        include: { actor: { select: { handle: true } } },
      });
      const messages = await tx.discussionMessage.findMany({
        where: {
          id: { in: rows.flatMap((r) => (r.messageId ? [r.messageId] : [])) },
          hiddenAt: null,
          thread: { hiddenAt: null },
        },
        select: {
          id: true,
          threadId: true,
          body: true,
          thread: {
            select: {
              title: true,
              topic: { select: { name: true, slug: true } },
            },
          },
        },
      });
      const byId = new Map(messages.map((m) => [m.id, m]));
      return rows.flatMap<AttentionView>((r) => {
        const m = r.messageId ? byId.get(r.messageId) : null;
        if (!m || r.conversationKey !== `discussion:${m.threadId}`) return [];
        return [
          {
            id: r.id,
            kind: r.kind as "REPLY" | "MENTION" | "CONVERSATION_UPDATE",
            title: `@${r.actor.handle} ${r.kind === "REPLY" ? "replied" : r.kind === "MENTION" ? "mentioned you" : "posted"} in ${m.thread.title} · ${m.thread.topic.name}`,
            preview: m.body,
            href: `${discussionPath(m.thread.topic.slug, m.threadId)}?messageId=${m.id}#message-${m.id}`,
            createdAt: r.createdAt,
          },
        ];
      });
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function getDiscussionInbox(
  accountId: string,
): Promise<InboxItem[]> {
  if (!topicsEnabled()) return [];
  return db.$queryRaw<InboxItem[]>`
    WITH unread AS (
      SELECT t."id", MAX(m."id") AS "lastId", COUNT(*)::int AS unread
      FROM "DiscussionThread" t JOIN "DiscussionMessage" m ON m."threadId" = t."id"
      JOIN "ConversationPreference" p ON p."conversationKey" = 'discussion:' || t."id" AND p."accountId" = ${accountId}
      LEFT JOIN "ReadPosition" r ON r."conversationKey" = p."conversationKey" AND r."accountId" = p."accountId"
      WHERE t."hiddenAt" IS NULL AND m."hiddenAt" IS NULL AND p."subscribed" = TRUE AND p."muted" = FALSE
        AND m."senderAccountId" <> ${accountId} AND m."id" > COALESCE(r."lastMessageId", 0)
      GROUP BY t."id" ORDER BY MAX(m."id") DESC LIMIT 30
    )
    SELECT 'discussion:' || t."id" AS key, topic."name" || ' · ' || t."title" AS title,
      '/topics/' || topic."slug" || '/discussions/' || t."id" || '?messageId=' || m."id" || '#message-' || m."id" AS href,
      m."body" AS preview, u.unread, m."createdAt" AS "updatedAt"
    FROM unread u JOIN "DiscussionThread" t ON t."id" = u."id"
      JOIN "Topic" topic ON topic."id" = t."topicId" JOIN "DiscussionMessage" m ON m."id" = u."lastId"
    ORDER BY m."id" DESC`;
}
