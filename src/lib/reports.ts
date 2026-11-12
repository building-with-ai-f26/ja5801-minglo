import { db } from "./db";
import { DirectMessageError, lockDirectConversation } from "./direct-messages";
import { parseConversationKey } from "./conversation-key";
import { readableRooms } from "./rooms";
import { allowAttempt } from "./rate-limit";
import { createHash } from "node:crypto";
import { lockReadableDiscussion } from "./topics";
import { topicsEnabled } from "./topic-launch";

export class ReportError extends Error {}
export async function reportMessage(
  accountId: string,
  conversationKey: string,
  messageId: number,
  reason: string,
) {
  const text = reason.trim();
  if (text.length < 10 || text.length > 1000)
    throw new ReportError("Describe the issue in 10–1,000 characters.");
  if (!Number.isSafeInteger(messageId) || messageId < 1)
    throw new ReportError("Choose a valid message.");
  const target = parseConversationKey(conversationKey);
  if (!target) throw new ReportError("Conversation or message unavailable.");
  return db.$transaction(async (tx) => {
    let allowed = false;
    if (target.kind === "public")
      allowed =
        !!(await tx.account.findUnique({
          where: { id: accountId },
          select: { id: true },
        })) &&
        !!(await tx.publicMessage.findUnique({
          where: { id: messageId },
          select: { id: true },
        }));
    else if (target.kind === "private") {
      const roomId = target.id;
      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
      allowed = !!(await tx.message.findFirst({
        where: { id: messageId, roomId, room: readableRooms(accountId) },
        select: { id: true },
      }));
    }
    if (target.kind === "direct") {
      const context = await lockDirectConversation(
        tx,
        target.id,
        accountId,
      ).catch((error) => {
        if (error instanceof DirectMessageError)
          throw new ReportError("Conversation or message unavailable.");
        throw error;
      });
      const participant = context.people.some((p) => p.id === accountId);
      allowed =
        participant &&
        !!(await tx.directMessage.findFirst({
          where: { id: messageId, conversationId: target.id },
          select: { id: true },
        }));
    }
    if (target.kind === "discussion" && topicsEnabled()) {
      await lockReadableDiscussion(tx, target.id, accountId).catch(() => {
        throw new ReportError("Conversation or message unavailable.");
      });
      allowed = !!(await tx.discussionMessage.findFirst({
        where: { id: messageId, threadId: target.id, hiddenAt: null },
        select: { id: true },
      }));
    }
    if (!allowed) throw new ReportError("Conversation or message unavailable.");
    const lock = createHash("sha256")
      .update(`report:${accountId}:${conversationKey}:${messageId}`)
      .digest()
      .readBigInt64BE();
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${lock})`;
    const previous = await tx.messageReport.findUnique({
      where: {
        reporterAccountId_conversationKey_messageId: {
          reporterAccountId: accountId,
          conversationKey,
          messageId,
        },
      },
      select: { id: true },
    });
    if (previous) return previous;
    if (!(await allowAttempt("report", accountId, 10, tx)))
      throw new ReportError("Too many reports. Try again in 15 minutes.");
    return tx.messageReport.create({
      data: {
        reporterAccountId: accountId,
        conversationKey,
        messageId,
        reason: text,
      },
      select: { id: true },
    });
  });
}
