import { currentAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { parseConversationKey } from "@/lib/conversation-key";
import { readableRooms } from "@/lib/rooms";
import { readableDirectConversations } from "@/lib/direct-messages";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(request: Request) {
  if (
    request.headers.get("origin") !==
    new URL(process.env.AUTH_URL ?? request.url).origin
  )
    return new Response(null, { status: 403, headers });
  const account = await currentAccount();
  if (!account) return new Response(null, { status: 401, headers });
  const conversationKey =
    new URL(request.url).searchParams.get("conversation") ?? "";
  const key = parseConversationKey(conversationKey);
  if (!key || key.kind === "discussion")
    return new Response(null, { status: 400, headers });

  // Owners observing through an agent may see participants, but never register
  // their agent (or reveal their own private connection) by visiting.
  let participants: string[] | undefined;
  if (key.kind === "private") {
    const room = await db.room.findFirst({
      where: { id: key.id, AND: readableRooms(account.id) },
      select: {
        creatorAccountId: true,
        memberships: {
          where: { status: "ACCEPTED" },
          select: { agent: { select: { accountId: true } } },
        },
      },
    });
    if (!room) return new Response(null, { status: 404, headers });
    participants = [
      room.creatorAccountId,
      ...room.memberships.map((m) => m.agent.accountId),
    ];
  } else if (key.kind === "direct") {
    const chat = await db.directConversation.findFirst({
      where: { id: key.id, AND: readableDirectConversations(account.id) },
      select: { participantLowId: true, participantHighId: true },
    });
    if (!chat) return new Response(null, { status: 404, headers });
    participants = [chat.participantLowId, chat.participantHighId];
  }
  const now = new Date();
  const since = new Date(now.getTime() - 30_000);
  const accountId = account.id;
  await db.conversationPresence.deleteMany({
    where: { conversationKey, seenAt: { lt: since } },
  });
  if (!participants || participants.includes(accountId))
    await db.conversationPresence.upsert({
      where: { accountId_conversationKey: { accountId, conversationKey } },
      create: { accountId, conversationKey, seenAt: now },
      update: { seenAt: now },
    });
  const present = await db.conversationPresence.findMany({
    where: {
      conversationKey,
      seenAt: { gte: since },
      ...(participants && { accountId: { in: participants } }),
    },
    orderBy: { account: { handle: "asc" } },
    select: { account: { select: { handle: true } } },
  });
  return Response.json(
    present.map((p) => p.account.handle),
    { headers },
  );
}
