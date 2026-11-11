import type { Message } from "@prisma/client";
import { db } from "./db";
import { messageSchema } from "./validation";
import { serializeMessage, senderSelect } from "./rooms";
import { recordActivity } from "./activity";
import { allowAttempt } from "./rate-limit";
export class MessageError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function postMessage(
  roomId: string,
  accountId: string,
  input: unknown,
) {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success)
    throw new MessageError(parsed.error.issues[0].message, 400);
  const { body, clientMessageId } = parsed.data;
  return db.$transaction(async (tx) => {
    // Serialize inserts within each room so an id cursor cannot skip a later-committing message.
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: { closedAt: true },
    });
    if (!room || room.closedAt)
      throw new MessageError(
        "This conversation is closed or unavailable.",
        403,
      );
    const membership = await tx.membership.findFirst({
      where: { roomId, status: "ACCEPTED", agent: { accountId } },
      include: { agent: { select: { id: true, ...senderSelect } } },
    });
    if (!membership)
      throw new MessageError(
        "Only admitted agents can post in this room.",
        403,
      );
    await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "id" = ${membership.agentId} FOR UPDATE`;
    const agent = await tx.agent.findUnique({
      where: { id: membership.agentId },
      select: { participationPausedAt: true },
    });
    if (agent?.participationPausedAt)
      throw new MessageError(
        "Your participation is paused in Minglo. Review Participation before posting.",
        403,
      );
    const previous = await tx.message.findUnique({
      where: {
        roomId_senderAgentId_clientMessageId: {
          roomId,
          senderAgentId: membership.agentId,
          clientMessageId,
        },
      },
    });
    if (previous) {
      if (previous.body !== body)
        throw new MessageError(
          "This retry key was already used for different text. Refresh before sending a new message.",
          409,
        );
      return serializeMessage({ ...previous, sender: membership.agent });
    }
    if (!(await allowAttempt("private-post", accountId, 60, tx)))
      throw new MessageError(
        "Too many private messages. Try again in 15 minutes.",
        429,
      );
    // A database constraint handles concurrent retries. Authorship always comes from the session's membership.
    const rows = await tx.$queryRaw<Message[]>`
      INSERT INTO "Message" ("roomId", "senderAgentId", "body", "clientMessageId")
      VALUES (${roomId}, ${membership.agentId}, ${body}, ${clientMessageId})
      ON CONFLICT ("roomId", "senderAgentId", "clientMessageId")
      DO UPDATE SET "clientMessageId" = EXCLUDED."clientMessageId"
      RETURNING *`;
    if (rows[0].body !== body)
      throw new MessageError(
        "This retry key was already used for different text. Refresh before sending a new message.",
        409,
      );
    await recordActivity(accountId, { client: tx, force: true });
    return serializeMessage({ ...rows[0], sender: membership.agent });
  });
}
