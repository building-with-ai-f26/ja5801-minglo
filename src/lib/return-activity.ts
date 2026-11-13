import { db } from "./db";
import { topicsEnabled } from "./topic-launch";
import { getDirectHomeGroups, type DirectHomeGroups } from "./direct-views";
import {
  contributionExcerpt,
  discussionMessageHref,
} from "./public-contributions";

// Topic follows are discovery bookmarks. Only an explicit discussion subscription
// joins this query; read positions and preferences always belong to this viewer.
export async function getDiscussionReturns(accountId: string) {
  if (!topicsEnabled()) return [];
  const candidates = await db.$queryRaw<{ id: number }[]>`
    SELECT latest."id" FROM (
      SELECT DISTINCT ON (m."threadId") m."id", m."createdAt"
      FROM "DiscussionMessage" m
      JOIN "DiscussionThread" t ON t."id" = m."threadId"
      JOIN "ConversationPreference" p ON p."conversationKey" = 'discussion:' || t."id"
        AND p."accountId" = ${accountId} AND p."subscribed" = true AND p."muted" = false
      LEFT JOIN "ReadPosition" r ON r."conversationKey" = p."conversationKey" AND r."accountId" = ${accountId}
      WHERE t."hiddenAt" IS NULL AND m."hiddenAt" IS NULL
        AND m."senderAccountId" <> ${accountId} AND m."id" > COALESCE(r."lastMessageId", 0)
        AND NOT EXISTS (
          SELECT 1 FROM "AccountBlock" b
          WHERE (b."blockerAccountId" = ${accountId} AND b."targetAccountId" = m."senderAccountId")
             OR (b."targetAccountId" = ${accountId} AND b."blockerAccountId" = m."senderAccountId")
        )
      ORDER BY m."threadId", m."id" DESC
    ) latest ORDER BY latest."createdAt" DESC, latest."id" DESC LIMIT 3`;
  const rows = await db.discussionMessage.findMany({
    where: {
      id: { in: candidates.map((c) => c.id) },
      hiddenAt: null,
      thread: { hiddenAt: null },
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      sender: { select: { handle: true } },
      thread: {
        select: {
          id: true,
          title: true,
          topic: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.thread.title,
    source: m.thread.topic.name,
    author: m.sender.handle,
    preview: contributionExcerpt(m.body),
    createdAt: m.createdAt,
    href: discussionMessageHref(m.thread.topic.slug, m.thread.id, m.id),
  }));
}

export async function getDirectReturns(
  accountId: string,
): Promise<DirectHomeGroups> {
  return getDirectHomeGroups(accountId);
}
