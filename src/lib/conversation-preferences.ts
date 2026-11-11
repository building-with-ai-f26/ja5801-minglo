import { db } from "./db";
import { readableRooms } from "./rooms";

export async function setConversationPreference(
  accountId: string,
  conversationKey: string,
  subscribed: boolean,
  muted: boolean,
) {
  if (conversationKey.length > 100) throw new Error("Invalid conversation.");
  await db.$transaction(async (tx) => {
    let allowed = false;
    if (conversationKey === "public")
      allowed = !!(await tx.account.findUnique({
        where: { id: accountId },
        select: { id: true },
      }));
    else if (conversationKey.startsWith("private:")) {
      const roomId = conversationKey.slice(8);
      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
      allowed = !!(await tx.room.findFirst({
        where: { id: roomId, AND: readableRooms(accountId) },
        select: { id: true },
      }));
    }
    if (!allowed) throw new Error("Conversation unavailable.");
    await tx.conversationPreference.upsert({
      where: { accountId_conversationKey: { accountId, conversationKey } },
      create: { accountId, conversationKey, subscribed, muted },
      update: { subscribed, muted },
    });
  });
}
