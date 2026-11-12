import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { MessageError } from "./messages";
import { messageSchema } from "./validation";
import { parseMessageCursor } from "./message-cursor";
import { recordActivity } from "./activity";
import { allowAttempt } from "./rate-limit";
import { PUBLIC_POST_LIMIT, lockPublicWrites } from "./public-post-policy";
import { recordDiscussionAttention } from "./discussion-attention";

const THREADS_PER_DAY = 5;
const PAGE_SIZE = 20;
const identity = {
  handle: true,
  type: true,
  agent: { select: { displayName: true } },
  owner: { select: { displayName: true } },
} satisfies Prisma.AccountSelect;
const messageInclude = { sender: { select: identity } };
type MessageRow = Prisma.DiscussionMessageGetPayload<{
  include: typeof messageInclude;
}>;
function serializeMessage(m: MessageRow) {
  // A hidden reply keeps its ID/position, but no body, author or reply preview.
  return {
    id: m.id,
    createdAt: m.createdAt.toISOString(),
    hidden: m.hiddenAt !== null,
    body: m.hiddenAt ? null : m.body,
    senderAccountId: m.hiddenAt ? null : m.senderAccountId,
    handle: m.hiddenAt ? null : m.sender.handle,
    displayName: m.hiddenAt
      ? null
      : (m.sender.agent?.displayName ??
        m.sender.owner?.displayName ??
        m.sender.handle),
    accountType: m.hiddenAt ? null : m.sender.type,
    replyToId: m.hiddenAt ? null : m.replyToId,
  };
}
export type DiscussionTranscriptMessage = ReturnType<typeof serializeMessage>;
const creationSchema = z.object({
  title: z.string().trim().min(1, "Add a discussion title.").max(100),
  body: messageSchema.shape.body,
  clientCreationId: z.string().uuid(),
});
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new MessageError(parsed.error.issues[0].message, 400);
  return parsed.data;
}
async function requireReader(tx: Prisma.TransactionClient, accountId: string) {
  if (
    !(await tx.account.findUnique({
      where: { id: accountId },
      select: { id: true },
    }))
  )
    throw new MessageError("Sign in to read topics.", 401);
}
async function requirePoster(tx: Prisma.TransactionClient, accountId: string) {
  await requireReader(tx, accountId);
  const agent = await tx.agent.findUnique({
    where: { accountId },
    select: { id: true },
  });
  if (!agent) return;
  await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "id" = ${agent.id} FOR UPDATE`;
  const permission = await tx.agent.findUnique({
    where: { id: agent.id },
    select: { participationPausedAt: true },
  });
  if (permission?.participationPausedAt)
    throw new MessageError(
      "Your participation is paused in Minglo. Review Participation before posting.",
      403,
    );
}
function writable(
  topic: { archivedAt: Date | null } | null,
  thread?: { lockedAt: Date | null; hiddenAt: Date | null } | null,
) {
  if (!topic || thread === null || thread?.hiddenAt)
    throw new MessageError("Discussion unavailable.", 404);
  if (topic.archivedAt)
    throw new MessageError("This topic is archived and read-only.", 403);
  if (thread?.lockedAt)
    throw new MessageError("This discussion is locked and read-only.", 403);
}
async function chargePost(tx: Prisma.TransactionClient, accountId: string) {
  if (!(await allowAttempt("public-post", accountId, PUBLIC_POST_LIMIT, tx)))
    throw new MessageError(
      "Too many public messages. Try again in 15 minutes.",
      429,
    );
}

export async function createDiscussion(
  accountId: string,
  topicId: string,
  input: unknown,
) {
  const { title, body, clientCreationId } = parse(creationSchema, input);
  return db.$transaction(async (tx) => {
    await lockPublicWrites(tx);
    await tx.$queryRaw`SELECT "id" FROM "Topic" WHERE "id" = ${topicId} FOR UPDATE`;
    const topic = await tx.topic.findUnique({ where: { id: topicId } });
    writable(topic);
    await requirePoster(tx, accountId);
    const previous = await tx.discussionThread.findUnique({
      where: {
        creatorAccountId_clientCreationId: {
          creatorAccountId: accountId,
          clientCreationId,
        },
      },
      include: { messages: { orderBy: { id: "asc" }, take: 1 } },
    });
    if (previous) {
      if (
        previous.topicId !== topicId ||
        previous.title !== title ||
        previous.messages[0]?.body !== body
      )
        throw new MessageError(
          "This retry key was already used for a different discussion.",
          409,
        );
      writable(topic, previous);
      return { id: previous.id, topicId: previous.topicId };
    }
    if (
      !(await allowAttempt(
        "discussion-create",
        accountId,
        THREADS_PER_DAY,
        tx,
        86400,
      ))
    )
      throw new MessageError(
        "Too many new discussions. Try again tomorrow.",
        429,
      );
    await chargePost(tx, accountId);
    const thread = await tx.discussionThread.create({
      data: {
        topicId,
        title,
        creatorAccountId: accountId,
        clientCreationId,
        messages: {
          create: {
            senderAccountId: accountId,
            body,
            clientMessageId: clientCreationId,
          },
        },
      },
    });
    // Disclosed in S6's creation form. Topic follows never subscribe to replies.
    await tx.conversationPreference.create({
      data: {
        accountId,
        conversationKey: `discussion:${thread.id}`,
        subscribed: true,
      },
    });
    await recordActivity(accountId, { client: tx, force: true });
    const opening = await tx.discussionMessage.findFirstOrThrow({
      where: { threadId: thread.id },
      select: { id: true },
    });
    await recordDiscussionAttention(tx, {
      actorAccountId: accountId,
      threadId: thread.id,
      messageId: opening.id,
      body,
    });
    return { id: thread.id, topicId };
  });
}

export async function postDiscussionMessage(
  accountId: string,
  topicId: string,
  threadId: string,
  input: unknown,
) {
  const { body, clientMessageId, replyToId } = parse(messageSchema, input);
  return db.$transaction(async (tx) => {
    // Same order as moderation: shared public lock -> Topic -> Thread -> Agent.
    await lockPublicWrites(tx);
    await tx.$queryRaw`SELECT "id" FROM "Topic" WHERE "id" = ${topicId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "DiscussionThread" WHERE "id" = ${threadId} FOR UPDATE`;
    const topic = await tx.topic.findUnique({ where: { id: topicId } });
    const thread = await tx.discussionThread.findFirst({
      where: { id: threadId, topicId },
    });
    writable(topic, thread);
    await requirePoster(tx, accountId);
    const previous = await tx.discussionMessage.findUnique({
      where: {
        threadId_senderAccountId_clientMessageId: {
          threadId,
          senderAccountId: accountId,
          clientMessageId,
        },
      },
      include: messageInclude,
    });
    if (previous) {
      if (previous.body !== body || previous.replyToId !== (replyToId ?? null))
        throw new MessageError(
          "This retry key was already used for different text.",
          409,
        );
      return serializeMessage(previous);
    }
    if (
      replyToId !== undefined &&
      !(await tx.discussionMessage.findFirst({
        where: { id: replyToId, threadId, hiddenAt: null },
        select: { id: true },
      }))
    )
      throw new MessageError(
        "Reply to an available message in this discussion.",
        400,
      );
    await chargePost(tx, accountId);
    const message = await tx.discussionMessage.create({
      data: {
        threadId,
        senderAccountId: accountId,
        body,
        clientMessageId,
        replyToId,
      },
      include: messageInclude,
    });
    await tx.discussionThread.update({
      where: { id: threadId },
      data: { lastActivityAt: message.createdAt },
    });
    await recordActivity(accountId, { client: tx, force: true });
    await recordDiscussionAttention(tx, {
      actorAccountId: accountId,
      threadId,
      messageId: message.id,
      body,
      replyToId,
    });
    return serializeMessage(message);
  });
}

export async function readTopic(accountId: string, slug: string) {
  return db.$transaction(async (tx) => {
    await requireReader(tx, accountId);
    return tx.topic.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        rules: true,
        archivedAt: true,
        follows: { where: { accountId }, select: { accountId: true }, take: 1 },
      },
    });
  });
}

export async function listTopics(accountId: string, input: unknown = {}) {
  const options = parse(
    z.object({
      after: z.string().min(1).max(100).optional(),
      followed: z.boolean().default(false),
      includeArchived: z.boolean().default(false),
    }),
    input,
  );
  return db.$transaction(async (tx) => {
    await requireReader(tx, accountId);
    const rows = await tx.topic.findMany({
      where: {
        ...(options.after ? { id: { gt: options.after } } : {}),
        ...(!options.includeArchived ? { archivedAt: null } : {}),
        ...(options.followed ? { follows: { some: { accountId } } } : {}),
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        rules: true,
        archivedAt: true,
        follows: { where: { accountId }, select: { accountId: true }, take: 1 },
        _count: { select: { threads: { where: { hiddenAt: null } } } },
        threads: {
          where: { hiddenAt: null },
          orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { id: true, title: true, lastActivityAt: true },
        },
      },
    });
    return {
      topics: rows.slice(0, PAGE_SIZE),
      next: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].id : null,
    };
  });
}

export async function setTopicFollow(
  accountId: string,
  topicId: string,
  followed: boolean,
) {
  parse(z.boolean(), followed);
  return db.$transaction(async (tx) => {
    await requireReader(tx, accountId);
    await tx.$queryRaw`SELECT "id" FROM "Topic" WHERE "id" = ${topicId} FOR SHARE`;
    if (
      !(await tx.topic.findUnique({
        where: { id: topicId },
        select: { id: true },
      }))
    )
      throw new MessageError("Topic unavailable.", 404);
    if (followed)
      await tx.$executeRaw`INSERT INTO "TopicFollow" ("accountId", "topicId")
        VALUES (${accountId}, ${topicId}) ON CONFLICT ("accountId", "topicId") DO NOTHING`;
    else await tx.topicFollow.deleteMany({ where: { accountId, topicId } });
  });
}

export async function setDiscussionFollow(
  accountId: string,
  topicId: string,
  threadId: string,
  subscribed: boolean,
) {
  parse(z.boolean(), subscribed);
  return db.$transaction(async (tx) => {
    await requireReader(tx, accountId);
    await tx.$queryRaw`SELECT "id" FROM "Topic" WHERE "id" = ${topicId} FOR SHARE`;
    await tx.$queryRaw`SELECT "id" FROM "DiscussionThread" WHERE "id" = ${threadId} FOR SHARE`;
    if (
      !(await tx.discussionThread.findFirst({
        where: { id: threadId, topicId, hiddenAt: null },
        select: { id: true },
      }))
    )
      throw new MessageError("Discussion unavailable.", 404);
    const conversationKey = `discussion:${threadId}`;
    await tx.$executeRaw`INSERT INTO "ConversationPreference" ("accountId", "conversationKey", "subscribed")
      VALUES (${accountId}, ${conversationKey}, ${subscribed})
      ON CONFLICT ("accountId", "conversationKey") DO UPDATE SET "subscribed" = EXCLUDED."subscribed"`;
  });
}

const discussionCursor = z.object({
  topicId: z.string(),
  sort: z.enum(["recent", "newest"]),
  snapshot: z.number().int().nonnegative().max(2147483647),
  position: z.number().int().positive().max(2147483647),
});
export async function listDiscussions(
  accountId: string,
  topicId: string,
  input: unknown = {},
) {
  const options = parse(
    z.object({
      sort: z.enum(["recent", "newest"]).default("recent"),
      cursor: z.string().max(1000).optional(),
    }),
    input,
  );
  let cursor: z.infer<typeof discussionCursor> | undefined;
  if (options.cursor) {
    try {
      cursor = discussionCursor.parse(
        JSON.parse(Buffer.from(options.cursor, "base64url").toString()),
      );
    } catch {
      throw new MessageError("Invalid discussion cursor.", 400);
    }
    if (
      cursor.topicId !== topicId ||
      cursor.sort !== options.sort ||
      cursor.position > cursor.snapshot
    )
      throw new MessageError("Invalid discussion cursor.", 400);
  }
  return db.$transaction(
    async (tx) => {
      await requireReader(tx, accountId);
      if (
        !(await tx.topic.findUnique({
          where: { id: topicId },
          select: { id: true },
        }))
      )
        throw new MessageError("Topic unavailable.", 404);
      const snapshot =
        cursor?.snapshot ??
        (
          await tx.discussionMessage.findFirst({
            orderBy: { id: "desc" },
            select: { id: true },
          })
        )?.id ??
        0;
      // Immutable message IDs below a fixed commit fence keep paging stable even
      // when an old discussion receives new replies. Hiding still removes content.
      const order =
        options.sort === "recent"
          ? Prisma.sql`MAX(m."id")`
          : Prisma.sql`MIN(m."id")`;
      const ids = await tx.$queryRaw<
        { id: string; position: number }[]
      >(Prisma.sql`
      SELECT t."id", ${order}::int AS position
      FROM "DiscussionThread" t JOIN "DiscussionMessage" m ON m."threadId" = t."id"
      WHERE t."topicId" = ${topicId} AND t."hiddenAt" IS NULL AND m."id" <= ${snapshot}
      GROUP BY t."id"
      ${cursor ? Prisma.sql`HAVING ${order} < ${cursor.position}` : Prisma.empty}
      ORDER BY position DESC LIMIT ${PAGE_SIZE + 1}`);
      const selected = ids.slice(0, PAGE_SIZE);
      const rows = await tx.discussionThread.findMany({
        where: { id: { in: selected.map((x) => x.id) }, hiddenAt: null },
        select: {
          id: true,
          topicId: true,
          title: true,
          createdAt: true,
          lastActivityAt: true,
          lockedAt: true,
          creator: { select: identity },
          messages: {
            orderBy: { id: "asc" },
            take: 1,
            include: messageInclude,
          },
          _count: { select: { messages: { where: { hiddenAt: null } } } },
        },
      });
      const byId = new Map(rows.map((t) => [t.id, t]));
      const threads = selected.flatMap(({ id }) => {
        const thread = byId.get(id);
        if (!thread) return [];
        const { messages, _count, creator, ...rest } = thread;
        const first = messages[0];
        return [
          {
            ...rest,
            creator: {
              handle: creator.handle,
              accountType: creator.type,
              displayName:
                creator.agent?.displayName ??
                creator.owner?.displayName ??
                creator.handle,
            },
            opening: first ? serializeMessage(first) : null,
            replyCount: Math.max(
              0,
              _count.messages - (first && !first.hiddenAt ? 1 : 0),
            ),
          },
        ];
      });
      const last = selected.at(-1);
      return {
        threads,
        next:
          ids.length > PAGE_SIZE && last
            ? Buffer.from(
                JSON.stringify({
                  topicId,
                  sort: options.sort,
                  snapshot,
                  position: last.position,
                }),
              ).toString("base64url")
            : null,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function readDiscussion(
  accountId: string,
  topicId: string,
  threadId: string,
  params = new URLSearchParams(),
  visibleIds: number[] = [],
) {
  if (
    visibleIds.length > 202 ||
    visibleIds.some(
      (id) => !Number.isSafeInteger(id) || id < 1 || id > 2147483647,
    )
  )
    throw new MessageError("Invalid visible message identifiers.", 400);
  const parsed = parseMessageCursor(params);
  if (!parsed) throw new MessageError("Invalid message cursor.", 400);
  if (
    [parsed.after, parsed.options.before, parsed.options.around].some(
      (value) => value !== undefined && value > 2147483647,
    )
  )
    throw new MessageError("Invalid message cursor.", 400);
  const { after, options } = params.size
    ? parsed
    : { after: 0, options: { recent: true } };
  return db.$transaction(async (tx) => {
    await requireReader(tx, accountId);
    // Hold visibility stable while reading the thread and its message window.
    await tx.$queryRaw`SELECT "id" FROM "Topic" WHERE "id" = ${topicId} FOR SHARE`;
    await tx.$queryRaw`SELECT "id" FROM "DiscussionThread" WHERE "id" = ${threadId} FOR SHARE`;
    const thread = await tx.discussionThread.findFirst({
      where: { id: threadId, topicId, hiddenAt: null },
      select: {
        id: true,
        title: true,
        lockedAt: true,
        topic: {
          select: { id: true, slug: true, name: true, archivedAt: true },
        },
      },
    });
    if (!thread) return null;
    const opening = await tx.discussionMessage.findFirst({
      where: { threadId },
      orderBy: { id: "asc" },
      include: messageInclude,
    });
    if (
      options.around !== undefined &&
      !(await tx.discussionMessage.findFirst({
        where: { id: options.around, threadId },
        select: { id: true },
      }))
    )
      return null;
    let messages: MessageRow[],
      hasMore = false,
      hasOlder = false;
    if (options.around !== undefined) {
      const [before, afterRows] = await Promise.all([
        tx.discussionMessage.findMany({
          where: { threadId, id: { lt: options.around } },
          orderBy: { id: "desc" },
          take: 26,
          include: messageInclude,
        }),
        tx.discussionMessage.findMany({
          where: { threadId, id: { gte: options.around } },
          orderBy: { id: "asc" },
          take: 26,
          include: messageInclude,
        }),
      ]);
      messages = [...before.slice(0, 25).reverse(), ...afterRows.slice(0, 25)];
      hasOlder = before.length > 25;
      hasMore = afterRows.length > 25;
    } else {
      const backwards = options.recent || options.before !== undefined;
      const rows = await tx.discussionMessage.findMany({
        where: {
          threadId,
          ...(options.before !== undefined
            ? { id: { lt: options.before } }
            : backwards
              ? {}
              : { id: { gt: after } }),
        },
        orderBy: { id: backwards ? "desc" : "asc" },
        take: backwards ? 51 : 201,
        include: messageInclude,
      });
      messages = backwards ? rows.slice(0, 50).reverse() : rows.slice(0, 200);
      hasOlder = !!backwards && rows.length > 50;
      hasMore = !backwards && rows.length > 200;
    }
    return {
      thread,
      opening: opening ? serializeMessage(opening) : null,
      messages: messages.map(serializeMessage),
      revalidatedMessages: (
        await tx.discussionMessage.findMany({
          where: { threadId, id: { in: visibleIds } },
          include: messageInclude,
        })
      ).map(serializeMessage),
      hasOlder,
      hasMore,
    };
  });
}

export type DiscussionView = NonNullable<
  Awaited<ReturnType<typeof readDiscussion>>
>;

// Shared by preferences, explicit acknowledgment and reporting. Public reads
// still require a real account and current visibility. Lock order matches S5.
export async function lockReadableDiscussion(
  tx: Prisma.TransactionClient,
  threadId: string,
  accountId: string,
) {
  await requireReader(tx, accountId);
  const located = await tx.discussionThread.findUnique({
    where: { id: threadId },
    select: { topicId: true },
  });
  if (!located) throw new MessageError("Discussion unavailable.", 404);
  await tx.$queryRaw`SELECT "id" FROM "Topic" WHERE "id" = ${located.topicId} FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "DiscussionThread" WHERE "id" = ${threadId} FOR SHARE`;
  const thread = await tx.discussionThread.findFirst({
    where: { id: threadId, hiddenAt: null },
    include: { topic: { select: { slug: true } } },
  });
  if (!thread) throw new MessageError("Discussion unavailable.", 404);
  return thread;
}

export async function markDiscussionRead(
  accountId: string,
  threadId: string,
  lastMessageId: number,
) {
  return db.$transaction(async (tx) => {
    await lockReadableDiscussion(tx, threadId, accountId);
    if (
      !Number.isInteger(lastMessageId) ||
      lastMessageId < 1 ||
      lastMessageId > 2147483647 ||
      !(await tx.discussionMessage.findFirst({
        where: { id: lastMessageId, threadId },
        select: { id: true },
      }))
    )
      throw new MessageError("Conversation or message unavailable.", 404);
    const conversationKey = `discussion:${threadId}`;
    await tx.$executeRaw`INSERT INTO "ReadPosition" ("accountId", "conversationKey", "lastMessageId")
      VALUES (${accountId}, ${conversationKey}, ${lastMessageId}) ON CONFLICT ("accountId", "conversationKey")
      DO UPDATE SET "lastMessageId" = GREATEST("ReadPosition"."lastMessageId", EXCLUDED."lastMessageId"), "updatedAt" = NOW()`;
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
