import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { topicsEnabled } from "./topic-launch";

export const CONTRIBUTION_PAGE_SIZE = 10;
const position = z.object({
  accountId: z.string().cuid(),
  generalMax: z.number().int().min(0).max(2147483647),
  discussionMax: z.number().int().min(0).max(2147483647),
  createdAt: z.string().datetime(),
  kind: z.enum(["general", "discussion"]),
  id: z.number().int().positive().max(2147483647),
});
type Position = z.infer<typeof position>;
export type PublicContribution = {
  id: number;
  kind: "general" | "discussion";
  body: string;
  createdAt: Date;
  source: string;
  title: string;
  href: string;
};
export const contributionExcerpt = (body: string) =>
  body.length > 440 ? body.slice(0, 440).trimEnd() + "…" : body;
export function discussionMessageHref(
  slug: string,
  threadId: string,
  id: number,
) {
  return `/topics/${encodeURIComponent(slug)}/discussions/${threadId}?messageId=${id}#message-${id}`;
}

// At equal timestamps, discussion sorts before General, then each table's ID.
function olderThan(cursor: Position | undefined, kind: Position["kind"]) {
  if (!cursor) return {};
  const sameTimestamp =
    cursor.kind === kind
      ? { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }
      : cursor.kind === "discussion" && kind === "general"
        ? { createdAt: new Date(cursor.createdAt) }
        : null;
  return {
    OR: [
      { createdAt: { lt: new Date(cursor.createdAt) } },
      ...(sameTimestamp ? [sameTimestamp] : []),
    ],
  };
}

export async function listPublicContributions(
  viewerId: string,
  accountId: string,
  encodedCursor?: string,
) {
  let cursor: Position | undefined;
  if (encodedCursor !== undefined) {
    try {
      if (encodedCursor.length > 1000) throw new Error();
      cursor = position.parse(
        JSON.parse(Buffer.from(encodedCursor, "base64url").toString()),
      );
      if (cursor.accountId !== accountId) throw new Error();
    } catch {
      return {
        items: [] as PublicContribution[],
        next: null,
        invalidCursor: true,
      };
    }
  }
  return db.$transaction(
    async (tx) => {
      if (
        !(await tx.account.findUnique({
          where: { id: viewerId },
          select: { id: true },
        }))
      )
        return {
          items: [] as PublicContribution[],
          next: null,
          invalidCursor: false,
        };
      // Separate immutable fences keep new posts out of later pages, including
      // backdated/tied posts. IDs from the two histories are never interchangeable.
      const [generalFence, discussionFence] = cursor
        ? [null, null]
        : await Promise.all([
            tx.publicMessage.findFirst({
              orderBy: { id: "desc" },
              select: { id: true },
            }),
            tx.discussionMessage.findFirst({
              orderBy: { id: "desc" },
              select: { id: true },
            }),
          ]);
      const generalMax = cursor?.generalMax ?? generalFence?.id ?? 0;
      const discussionMax = cursor?.discussionMax ?? discussionFence?.id ?? 0;
      const [general, discussions] = await Promise.all([
        tx.publicMessage.findMany({
          where: {
            senderAccountId: accountId,
            AND: [{ id: { lte: generalMax } }, olderThan(cursor, "general")],
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: CONTRIBUTION_PAGE_SIZE + 1,
          select: { id: true, body: true, createdAt: true },
        }),
        topicsEnabled()
          ? tx.discussionMessage.findMany({
              // Filter at the database boundary: hidden evidence never enters a preview.
              where: {
                senderAccountId: accountId,
                hiddenAt: null,
                thread: { hiddenAt: null },
                AND: [
                  { id: { lte: discussionMax } },
                  olderThan(cursor, "discussion"),
                ],
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: CONTRIBUTION_PAGE_SIZE + 1,
              select: {
                id: true,
                body: true,
                createdAt: true,
                thread: {
                  select: {
                    id: true,
                    title: true,
                    topic: { select: { name: true, slug: true } },
                  },
                },
              },
            })
          : [],
      ]);
      const ordered: PublicContribution[] = [
        ...general.map((m) => ({
          ...m,
          body: contributionExcerpt(m.body),
          kind: "general" as const,
          source: "General · Public chat",
          title: "General",
          href: `/public-room?messageId=${m.id}#message-${m.id}`,
        })),
        ...discussions.map((m) => ({
          id: m.id,
          body: contributionExcerpt(m.body),
          createdAt: m.createdAt,
          kind: "discussion" as const,
          source: m.thread.topic.name,
          title: m.thread.title,
          href: discussionMessageHref(m.thread.topic.slug, m.thread.id, m.id),
        })),
      ].sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          (a.kind === b.kind ? b.id - a.id : a.kind === "discussion" ? -1 : 1),
      );
      const items = ordered.slice(0, CONTRIBUTION_PAGE_SIZE);
      const last = items.at(-1);
      return {
        items,
        next:
          ordered.length > CONTRIBUTION_PAGE_SIZE && last
            ? Buffer.from(
                JSON.stringify({
                  accountId,
                  generalMax,
                  discussionMax,
                  createdAt: last.createdAt.toISOString(),
                  kind: last.kind,
                  id: last.id,
                } satisfies Position),
              ).toString("base64url")
            : null,
        invalidCursor: false,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
