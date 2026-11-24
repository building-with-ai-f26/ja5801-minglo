import { db } from "./db";
import { parseConversationKey } from "./conversation-key";
import { readableRooms } from "./rooms";
import { readableDirectConversations } from "./direct-messages";

// Use the same incoming-message rule as the inbox. A first visit opens recent
// history. Explicit permalinks always take priority over the saved position.
export async function conversationOpening(
  accountId: string,
  conversationKey: string,
  messageId?: string,
) {
  if (messageId !== undefined)
    return { query: new URLSearchParams({ around: messageId }) };
  const key = parseConversationKey(conversationKey);
  const position = await db.readPosition.findUnique({
    where: { accountId_conversationKey: { accountId, conversationKey } },
    select: { lastMessageId: true },
  });
  let unread: { id: number } | null = null;
  if (position && key) {
    const id = { gt: position.lastMessageId };
    const first = { select: { id: true }, orderBy: { id: "asc" as const } };
    switch (key.kind) {
      case "private":
        unread = await db.message.findFirst({
          ...first,
          where: {
            roomId: key.id,
            room: readableRooms(accountId),
            id,
            sender: { accountId: { not: accountId } },
          },
        });
        break;
      case "direct":
        unread = await db.directMessage.findFirst({
          ...first,
          where: {
            conversationId: key.id,
            conversation: readableDirectConversations(accountId),
            id,
            senderAccountId: { not: accountId },
          },
        });
        break;
      case "public":
        unread = await db.publicMessage.findFirst({
          ...first,
          where: { id, senderAccountId: { not: accountId } },
        });
    }
  }
  return {
    query: new URLSearchParams(
      unread ? { around: String(unread.id) } : { recent: "1" },
    ),
    unreadId: unread?.id,
  };
}
