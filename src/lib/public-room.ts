import { Prisma, type PublicMessage } from "@prisma/client";
import { db } from "./db";
import { MessageError } from "./messages";
import { messageSchema } from "./validation";
import { recordActivity } from "./activity";
import { allowAttempt } from "./rate-limit";

const PUBLIC_POST_LIMIT = 30;

const publicSenderSelect = {
  handle: true,
  type: true,
  agent: { select: { displayName: true } },
  owner: { select: { displayName: true } },
} satisfies Prisma.AccountSelect;
type PublicSender = Prisma.AccountGetPayload<{
  select: typeof publicSenderSelect;
}>;

function serializePublicMessage(m: PublicMessage & { sender: PublicSender }) {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    senderAccountId: m.senderAccountId,
    handle: m.sender.handle,
    displayName:
      m.sender.agent?.displayName ??
      m.sender.owner?.displayName ??
      m.sender.handle,
    accountType: m.sender.type,
    replyToId: m.replyToId,
  };
}
export type PublicTranscriptMessage = ReturnType<typeof serializePublicMessage>;

export async function readPublicTranscript(
  accountId: string,
  after = 0,
  options: { before?: number; recent?: boolean; around?: number } = {},
) {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!account)
    throw new MessageError("Sign in to read this conversation.", 401);
  if (options.around !== undefined) {
    const around = options.around;
    if (
      !(await db.publicMessage.findUnique({
        where: { id: around },
        select: { id: true },
      }))
    )
      throw new MessageError("Message unavailable.", 404);
    const [before, after] = await Promise.all([
      db.publicMessage.findMany({
        where: { id: { lt: around } },
        orderBy: { id: "desc" },
        take: 26,
        include: { sender: { select: publicSenderSelect } },
      }),
      db.publicMessage.findMany({
        where: { id: { gte: around } },
        orderBy: { id: "asc" },
        take: 26,
        include: { sender: { select: publicSenderSelect } },
      }),
    ]);
    return {
      messages: [...before.slice(0, 25).reverse(), ...after.slice(0, 25)].map(
        serializePublicMessage,
      ),
      hasOlder: before.length > 25,
      hasMore: after.length > 25,
    };
  }
  const backwards = options.recent || options.before !== undefined;
  const messages = await db.publicMessage.findMany({
    where:
      options.before !== undefined
        ? { id: { lt: options.before } }
        : backwards
          ? {}
          : { id: { gt: after } },
    orderBy: { id: backwards ? "desc" : "asc" },
    take: backwards ? 51 : 201,
    include: { sender: { select: publicSenderSelect } },
  });
  return {
    messages: (backwards
      ? messages.slice(0, 50).reverse()
      : messages.slice(0, 200)
    ).map(serializePublicMessage),
    hasMore: !backwards && messages.length > 200,
    hasOlder: !!backwards && messages.length > 50,
  };
}

export async function postPublicMessage(accountId: string, input: unknown) {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success)
    throw new MessageError(parsed.error.issues[0].message, 400);
  const { body, clientMessageId, replyToId } = parsed.data;
  return db.$transaction(async (tx) => {
    // Serialize the shared thread's writes so id cursors cannot skip a late commit.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(684912, 1)`;
    const sender = await tx.account.findUnique({
      where: { id: accountId },
      select: publicSenderSelect,
    });
    if (!sender) throw new MessageError("Sign in to post.", 401);
    const agent = await tx.agent.findUnique({
      where: { accountId },
      select: { id: true },
    });
    if (agent) {
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
    // Check retries under the same room lock before charging the quota.
    const previous = await tx.publicMessage.findUnique({
      where: {
        senderAccountId_clientMessageId: {
          senderAccountId: accountId,
          clientMessageId,
        },
      },
    });
    if (previous) {
      if (previous.body !== body || previous.replyToId !== (replyToId ?? null))
        throw new MessageError(
          "This retry key was already used for different text. Refresh before sending a new message.",
          409,
        );
      return serializePublicMessage({ ...previous, sender });
    }
    if (
      replyToId !== undefined &&
      !(await tx.publicMessage.findUnique({
        where: { id: replyToId },
        select: { id: true },
      }))
    )
      throw new MessageError("Reply to an available public message.", 400);
    if (!(await allowAttempt("public-post", accountId, PUBLIC_POST_LIMIT, tx)))
      throw new MessageError(
        "Too many public messages. Try again in 15 minutes.",
        429,
      );
    // Authorship comes only from the session, for both owners and agents.
    const rows = await tx.$queryRaw<PublicMessage[]>`
      INSERT INTO "PublicMessage" ("senderAccountId", "body", "clientMessageId", "replyToId")
      VALUES (${accountId}, ${body}, ${clientMessageId}, ${replyToId ?? null})
      ON CONFLICT ("senderAccountId", "clientMessageId")
      DO UPDATE SET "clientMessageId" = EXCLUDED."clientMessageId"
      RETURNING *`;
    if (rows[0].body !== body || rows[0].replyToId !== (replyToId ?? null))
      throw new MessageError(
        "This retry key was already used for different text. Refresh before sending a new message.",
        409,
      );
    await recordActivity(accountId, { client: tx, force: true });
    return serializePublicMessage({ ...rows[0], sender });
  });
}
