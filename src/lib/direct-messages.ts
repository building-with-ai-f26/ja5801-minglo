import { createHash } from "node:crypto";
import { Prisma, type DirectConversation } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { lockBlockPair } from "./blocks";
import { allowAttempt } from "./rate-limit";
import { recordActivity } from "./activity";
import { messageSchema } from "./validation";
import { parseMessageCursor } from "./message-cursor";

export const DIRECT_OWNER_POLICY =
  "Current and future connected owners of participating agents can read all retained messages, including introductions. Only the two participating accounts can send messages or decide requests.";
export const DIRECT_REQUESTS_PER_DAY = 5;
const PRIVATE_POST_LIMIT = 60;
const identitySelect = {
  id: true,
  handle: true,
  type: true,
  owner: { select: { displayName: true } },
  agent: {
    select: {
      id: true,
      displayName: true,
      participationPausedAt: true,
      owner: {
        select: {
          account: {
            select: {
              id: true,
              handle: true,
              owner: { select: { displayName: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.AccountSelect;
type Identity = Prisma.AccountGetPayload<{ select: typeof identitySelect }>;
type Tx = Prisma.TransactionClient;
// Callers must derive accountId from their authenticated session, never a form.
// HTTP and Server Action callers authenticate independently before invoking these services.
export class DirectMessageError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const idSchema = z.string().cuid();
const consentSchema = z.object({
  visibilityConfirmed: z.literal(true),
  visibilityToken: z.string().regex(/^[a-f0-9]{64}$/),
});
const introductionSchema = messageSchema
  .omit({ replyToId: true })
  .extend({ body: z.string().trim().min(1).max(500) })
  .merge(consentSchema);
const decisionSchema = z.object({
  decision: z.enum(["accept", "decline", "cancel"]),
  requestVersion: z.number().int().positive(),
  visibilityConfirmed: z.boolean().optional(),
  visibilityToken: z.string().optional(),
});
function fail(message: string, status = 400): never {
  throw new DirectMessageError(message, status);
}
function validId(value: string) {
  if (!idSchema.safeParse(value).success)
    fail("Conversation or account unavailable.", 404);
}
function publicIdentity(account: Identity) {
  return {
    id: account.id,
    handle: account.handle,
    accountType: account.type,
    displayName:
      account.agent?.displayName ??
      account.owner?.displayName ??
      account.handle,
  };
}
function visibility(people: Identity[]) {
  const owners = people.flatMap((p) =>
    p.agent?.owner ? [p.agent.owner.account] : [],
  );
  const readers = new Map(
    people.map((p) => [
      p.id,
      { ...publicIdentity(p), role: "participant" as "participant" | "owner" },
    ]),
  );
  for (const owner of owners)
    if (!readers.has(owner.id))
      readers.set(owner.id, {
        id: owner.id,
        handle: owner.handle,
        displayName: owner.owner?.displayName ?? owner.handle,
        accountType: "OWNER",
        role: "owner",
      });
  const token = createHash("sha256")
    .update(
      JSON.stringify({
        policy: DIRECT_OWNER_POLICY,
        people: people.map((p) => [p.id, p.agent?.owner?.account.id ?? null]),
      }),
    )
    .digest("hex");
  return {
    participants: people.map(publicIdentity),
    readers: [...readers.values()],
    visibilityToken: token,
    visibilityPolicy: DIRECT_OWNER_POLICY,
  };
}
function confirmVisibility(input: unknown, people: Identity[]) {
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) fail("Review and confirm who can read this chat.");
  if (parsed.data.visibilityToken !== visibility(people).visibilityToken)
    fail(
      "The chat's readers changed. Review the current readers before continuing.",
      409,
    );
}
function summary(
  conversation: DirectConversation,
  people: Identity[],
  accountId: string,
) {
  return {
    id: conversation.id,
    status: conversation.status,
    requestedByAccountId: conversation.requestedByAccountId,
    requestVersion: conversation.requestVersion,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    isParticipant: people.some((p) => p.id === accountId),
    postingPaused: !!people.find((p) => p.id === accountId)?.agent
      ?.participationPausedAt,
    ...visibility(people),
  };
}
export function readableDirectConversations(
  accountId: string,
): Prisma.DirectConversationWhereInput {
  return {
    OR: [
      { participantLowId: accountId },
      { participantHighId: accountId },
      { participantLow: { agent: { owner: { accountId } } } },
      { participantHigh: { agent: { owner: { accountId } } } },
    ],
  };
}
// Lock order: block/pair advisory lock -> participant Agent rows (sorted) -> conversation.
// Claim/disconnect/pause already lock those same Agent rows and never take a pair lock.
async function lockPair(tx: Tx, first: string, second: string) {
  validId(first);
  validId(second);
  if (first === second) fail("Choose another account to message.");
  const pair = [first, second].sort();
  await lockBlockPair(tx, pair[0], pair[1]);
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Agent" WHERE "accountId" IN (${Prisma.join(pair)}) ORDER BY "id" FOR UPDATE`,
  );
  const people = await tx.account.findMany({
    where: { id: { in: pair } },
    select: identitySelect,
    orderBy: { id: "asc" },
  });
  if (people.length !== 2) fail("Account unavailable.", 404);
  // Match the canonical pair even if the database's locale sorts text differently.
  people.sort((a, b) => pair.indexOf(a.id) - pair.indexOf(b.id));
  return { pair, people };
}
export async function lockDirectConversation(
  tx: Tx,
  conversationId: string,
  accountId: string,
) {
  validId(conversationId);
  validId(accountId);
  const initial = await tx.directConversation.findFirst({
    where: { id: conversationId, AND: readableDirectConversations(accountId) },
  });
  if (!initial) fail("Conversation unavailable.", 404);
  const { people } = await lockPair(
    tx,
    initial.participantLowId,
    initial.participantHighId,
  );
  await tx.$queryRaw`SELECT "id" FROM "DirectConversation" WHERE "id" = ${conversationId} FOR UPDATE`;
  const conversation = await tx.directConversation.findFirst({
    where: { id: conversationId, AND: readableDirectConversations(accountId) },
  });
  if (!conversation) fail("Conversation unavailable.", 404);
  return { conversation, people };
}
async function assertUnblocked(tx: Tx, people: Identity[]) {
  const [a, b] = people;
  if (
    await tx.accountBlock.findFirst({
      where: {
        OR: [
          { blockerAccountId: a.id, targetAccountId: b.id },
          { blockerAccountId: b.id, targetAccountId: a.id },
        ],
      },
      select: { blockerAccountId: true },
    })
  )
    fail("Messaging is unavailable due to account preferences.", 403);
}
function assertParticipant(accountId: string, people: Identity[]) {
  const actor = people.find((p) => p.id === accountId);
  if (!actor)
    fail("Only the participating account can send or decide a request.", 403);
  return actor;
}
function assertPosting(actor: Identity) {
  if (actor.agent?.participationPausedAt)
    fail(
      "Your participation is paused in Minglo. Review Participation before posting.",
      403,
    );
}
async function attention(
  tx: Tx,
  c: DirectConversation,
  actorId: string,
  messageId: number,
  request: boolean,
  people: Identity[],
) {
  const recipientAccountId =
    c.participantLowId === actorId ? c.participantHighId : c.participantLowId;
  const key = `direct:${c.id}`;
  const ownerIds = visibility(people)
    .readers.filter((r) => r.role === "owner" && r.id !== actorId)
    .map((r) => r.id);
  const preferences = await tx.conversationPreference.findMany({
    where: {
      conversationKey: key,
      accountId: { in: [recipientAccountId, ...ownerIds] },
    },
  });
  const recipients = new Set<string>();
  if (
    request ||
    !preferences.find((p) => p.accountId === recipientAccountId)?.muted
  )
    recipients.add(recipientAccountId);
  if (!request)
    for (const p of preferences)
      if (ownerIds.includes(p.accountId) && p.subscribed && !p.muted)
        recipients.add(p.accountId);
  const blocks = await tx.accountBlock.findMany({
    where: {
      OR: [
        { blockerAccountId: actorId, targetAccountId: { in: [...recipients] } },
        { targetAccountId: actorId, blockerAccountId: { in: [...recipients] } },
      ],
    },
  });
  for (const b of blocks)
    recipients.delete(
      b.blockerAccountId === actorId ? b.targetAccountId : b.blockerAccountId,
    );
  await tx.attentionItem.createMany({
    data: [...recipients].map((recipientAccountId) => ({
      recipientAccountId,
      actorAccountId: actorId,
      kind: request ? ("DIRECT_REQUEST" as const) : ("DIRECT_MESSAGE" as const),
      conversationKey: key,
      directConversationId: c.id,
      requestVersion: request ? c.requestVersion : null,
      messageId,
      sourceKey: request
        ? `direct-request:${c.id}:${c.requestVersion}`
        : `direct-message:${c.id}:${messageId}`,
    })),
    skipDuplicates: true,
  });
}
export async function getDirectRequestContext(
  accountId: string,
  targetAccountId: string,
) {
  return db.$transaction(async (tx) => {
    const { pair, people } = await lockPair(tx, accountId, targetAccountId);
    await assertUnblocked(tx, people);
    const c = await tx.directConversation.findUnique({
      where: {
        participantLowId_participantHighId: {
          participantLowId: pair[0],
          participantHighId: pair[1],
        },
      },
    });
    return {
      ...visibility(people),
      conversation: c ? summary(c, people, accountId) : null,
    };
  });
}
export async function requestDirectConversation(
  accountId: string,
  targetAccountId: string,
  input: unknown,
) {
  const parsed = introductionSchema.safeParse(input);
  if (!parsed.success)
    fail(
      "Write an introduction of 1–500 characters and confirm the chat's readers.",
    );
  const data = parsed.data;
  return db.$transaction(async (tx) => {
    const { pair, people } = await lockPair(tx, accountId, targetAccountId);
    await assertUnblocked(tx, people);
    assertPosting(assertParticipant(accountId, people));
    let c = await tx.directConversation.findUnique({
      where: {
        participantLowId_participantHighId: {
          participantLowId: pair[0],
          participantHighId: pair[1],
        },
      },
    });
    if (c) {
      const previous = await tx.directMessage.findUnique({
        where: {
          conversationId_senderAccountId_clientMessageId: {
            conversationId: c.id,
            senderAccountId: accountId,
            clientMessageId: data.clientMessageId,
          },
        },
      });
      if (previous) {
        if (previous.body !== data.body || previous.requestVersion === null)
          fail("This retry key was already used for different content.", 409);
        return summary(c, people, accountId);
      }
      if (c.status === "ACTIVE" || c.status === "PENDING")
        return summary(c, people, accountId);
      if (c.requestedByAccountId === accountId)
        fail(
          "This request ended. The other account must initiate a new request.",
          409,
        );
    }
    confirmVisibility(data, people);
    if (
      !(await allowAttempt(
        "direct-request",
        accountId,
        DIRECT_REQUESTS_PER_DAY,
        tx,
        86400,
      ))
    )
      fail("Too many new message requests. Try again tomorrow.", 429);
    if (
      !(await allowAttempt("private-post", accountId, PRIVATE_POST_LIMIT, tx))
    )
      fail("Too many private messages. Try again in 15 minutes.", 429);
    c = c
      ? await tx.directConversation.update({
          where: { id: c.id },
          data: {
            status: "PENDING",
            requestedByAccountId: accountId,
            requestVersion: { increment: 1 },
          },
        })
      : await tx.directConversation.create({
          data: {
            participantLowId: pair[0],
            participantHighId: pair[1],
            requestedByAccountId: accountId,
          },
        });
    const message = await tx.directMessage.create({
      data: {
        conversationId: c.id,
        senderAccountId: accountId,
        body: data.body,
        clientMessageId: data.clientMessageId,
        requestVersion: c.requestVersion,
      },
    });
    await attention(tx, c, accountId, message.id, true, people);
    await recordActivity(accountId, { client: tx, force: true });
    return summary(c, people, accountId);
  });
}
export async function respondToDirectRequest(
  accountId: string,
  conversationId: string,
  input: unknown,
) {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) fail("Choose a valid request decision and version.");
  const data = parsed.data;
  return db.$transaction(async (tx) => {
    const { conversation: c, people } = await lockDirectConversation(
      tx,
      conversationId,
      accountId,
    );
    assertParticipant(accountId, people);
    if ((data.decision === "cancel") !== (c.requestedByAccountId === accountId))
      fail(
        "Only the request's recipient can accept or decline; only its sender can cancel.",
        403,
      );
    if (data.requestVersion !== c.requestVersion)
      fail("This request changed. Review it again.", 409);
    const status =
      data.decision === "accept"
        ? "ACTIVE"
        : data.decision === "decline"
          ? "DECLINED"
          : "CANCELLED";
    if (c.status === status) return summary(c, people, accountId);
    if (c.status !== "PENDING") fail("This request is no longer pending.", 409);
    if (data.decision === "accept") {
      await assertUnblocked(tx, people);
      confirmVisibility(data, people);
    }
    const changed = await tx.directConversation.update({
      where: { id: c.id },
      data: { status },
    });
    await tx.attentionItem.updateMany({
      where: {
        directConversationId: c.id,
        kind: "DIRECT_REQUEST",
        requestVersion: c.requestVersion,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    await recordActivity(accountId, { client: tx, force: true });
    return summary(changed, people, accountId);
  });
}
const senderSelect = {
  handle: true,
  type: true,
  agent: { select: { displayName: true } },
  owner: { select: { displayName: true } },
} satisfies Prisma.AccountSelect;
function serialize(
  m: Prisma.DirectMessageGetPayload<{
    include: { sender: { select: typeof senderSelect } };
  }>,
) {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    senderAccountId: m.senderAccountId,
    displayName:
      m.sender.agent?.displayName ??
      m.sender.owner?.displayName ??
      m.sender.handle,
    handle: m.sender.handle,
    accountType: m.sender.type,
    replyToId: m.replyToId,
    requestVersion: m.requestVersion,
  };
}
export async function postDirectMessage(
  accountId: string,
  conversationId: string,
  input: unknown,
) {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const data = parsed.data;
  return db.$transaction(async (tx) => {
    const { conversation: c, people } = await lockDirectConversation(
      tx,
      conversationId,
      accountId,
    );
    const actor = assertParticipant(accountId, people);
    await assertUnblocked(tx, people);
    assertPosting(actor);
    if (c.status !== "ACTIVE")
      fail("The recipient must accept before more messages can be sent.", 403);
    const previous = await tx.directMessage.findUnique({
      where: {
        conversationId_senderAccountId_clientMessageId: {
          conversationId,
          senderAccountId: accountId,
          clientMessageId: data.clientMessageId,
        },
      },
      include: { sender: { select: senderSelect } },
    });
    if (previous) {
      if (
        previous.body !== data.body ||
        previous.replyToId !== (data.replyToId ?? null) ||
        previous.requestVersion !== null
      )
        fail("This retry key was already used for different content.", 409);
      return serialize(previous);
    }
    if (
      data.replyToId !== undefined &&
      !(await tx.directMessage.findFirst({
        where: { id: data.replyToId, conversationId },
        select: { id: true },
      }))
    )
      fail("Reply to a message in this chat.");
    if (
      !(await allowAttempt("private-post", accountId, PRIVATE_POST_LIMIT, tx))
    )
      fail("Too many private messages. Try again in 15 minutes.", 429);
    const message = await tx.directMessage.create({
      data: {
        conversationId,
        senderAccountId: accountId,
        body: data.body,
        clientMessageId: data.clientMessageId,
        replyToId: data.replyToId,
      },
      include: { sender: { select: senderSelect } },
    });
    await tx.directConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    await attention(tx, c, accountId, message.id, false, people);
    await recordActivity(accountId, { client: tx, force: true });
    return serialize(message);
  });
}
export async function readDirectTranscript(
  conversationId: string,
  accountId: string,
  params = new URLSearchParams("recent=1"),
) {
  const cursor = parseMessageCursor(params);
  if (!cursor) fail("Invalid message cursor.");
  try {
    return await db.$transaction(async (tx) => {
      const { conversation, people } = await lockDirectConversation(
        tx,
        conversationId,
        accountId,
      );
      const messagingBlocked = !!(await tx.accountBlock.findFirst({
        where: {
          OR: [
            {
              blockerAccountId: conversation.participantLowId,
              targetAccountId: conversation.participantHighId,
            },
            {
              blockerAccountId: conversation.participantHighId,
              targetAccountId: conversation.participantLowId,
            },
          ],
        },
        select: { blockerAccountId: true },
      }));
      const context = {
        ...summary(conversation, people, accountId),
        messagingBlocked,
      };
      const { after, options } = cursor;
      const base = { conversationId };
      if (options.around !== undefined) {
        if (
          !(await tx.directMessage.findFirst({
            where: { ...base, id: options.around },
            select: { id: true },
          }))
        )
          fail("Message unavailable.", 404);
        const [before, newer] = await Promise.all([
          tx.directMessage.findMany({
            where: { ...base, id: { lt: options.around } },
            orderBy: { id: "desc" },
            take: 26,
            include: { sender: { select: senderSelect } },
          }),
          tx.directMessage.findMany({
            where: { ...base, id: { gte: options.around } },
            orderBy: { id: "asc" },
            take: 26,
            include: { sender: { select: senderSelect } },
          }),
        ]);
        return {
          conversation: context,
          messages: [
            ...before.slice(0, 25).reverse(),
            ...newer.slice(0, 25),
          ].map(serialize),
          hasOlder: before.length > 25,
          hasMore: newer.length > 25,
        };
      }
      const backwards = !!options.recent || options.before !== undefined;
      const rows = await tx.directMessage.findMany({
        where: {
          ...base,
          ...(options.before !== undefined
            ? { id: { lt: options.before } }
            : backwards
              ? {}
              : { id: { gt: after } }),
        },
        orderBy: { id: backwards ? "desc" : "asc" },
        take: backwards ? 51 : 201,
        include: { sender: { select: senderSelect } },
      });
      return {
        conversation: context,
        messages: (backwards
          ? rows.slice(0, 50).reverse()
          : rows.slice(0, 200)
        ).map(serialize),
        hasOlder: backwards && rows.length > 50,
        hasMore: !backwards && rows.length > 200,
      };
    });
  } catch (error) {
    if (error instanceof DirectMessageError && error.status === 404)
      return null;
    throw error;
  }
}
export async function markDirectConversationRead(
  accountId: string,
  conversationId: string,
  lastMessageId: number,
) {
  if (!Number.isSafeInteger(lastMessageId) || lastMessageId < 1)
    fail("Invalid reading position.");
  await db.$transaction(async (tx) => {
    await lockDirectConversation(tx, conversationId, accountId);
    if (
      !(await tx.directMessage.findFirst({
        where: { id: lastMessageId, conversationId },
        select: { id: true },
      }))
    )
      fail("Message unavailable.", 404);
    const key = `direct:${conversationId}`;
    await tx.$executeRaw`INSERT INTO "ReadPosition" ("accountId","conversationKey","lastMessageId") VALUES (${accountId},${key},${lastMessageId}) ON CONFLICT ("accountId","conversationKey") DO UPDATE SET "lastMessageId"=GREATEST("ReadPosition"."lastMessageId",EXCLUDED."lastMessageId"),"updatedAt"=NOW()`;
    await tx.attentionItem.updateMany({
      where: {
        recipientAccountId: accountId,
        directConversationId: conversationId,
        kind: "DIRECT_MESSAGE",
        messageId: { lte: lastMessageId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  });
}
