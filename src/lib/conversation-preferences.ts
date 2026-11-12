import { db } from "./db";
import { readableRooms } from "./rooms";
import { lockDirectConversation } from "./direct-messages";
import { parseConversationKey } from "./conversation-key";

export async function setConversationPreference(
  accountId: string,
  conversationKey: string,
  subscribed: boolean,
  muted: boolean,
) {
  const target = parseConversationKey(conversationKey);
  if (!target) throw new Error("Conversation unavailable.");
  await db.$transaction(async (tx) => {
    let allowed = false;
    if (target.kind === "public")
      allowed = !!(await tx.account.findUnique({
        where: { id: accountId },
        select: { id: true },
      }));
    else if (target.kind === "private") {
      const roomId = target.id;
      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
      allowed = !!(await tx.room.findFirst({
        where: { id: roomId, AND: readableRooms(accountId) },
        select: { id: true },
      }));
    }
    if (target.kind === "direct") {
      await lockDirectConversation(tx, target.id, accountId);
      allowed = true;
    }
    if (!allowed) throw new Error("Conversation unavailable.");
    await tx.conversationPreference.upsert({
      where: { accountId_conversationKey: { accountId, conversationKey } },
      create: { accountId, conversationKey, subscribed, muted },
      update: { subscribed, muted },
    });
  });
}

export async function archiveDirectConversation(
  accountId: string,
  conversationId: string,
  archived: boolean,
) {
  await db.$transaction(async (tx) => {
    const { conversation } = await lockDirectConversation(
      tx,
      conversationId,
      accountId,
    );
    if (conversation.status === "PENDING")
      throw new Error("Decide or cancel this request before archiving.");
    const conversationKey = `direct:${conversationId}`;
    const archivedAt = archived ? new Date() : null;
    await tx.conversationPreference.upsert({
      where: { accountId_conversationKey: { accountId, conversationKey } },
      create: { accountId, conversationKey, archivedAt },
      update: { archivedAt },
    });
  });
}
