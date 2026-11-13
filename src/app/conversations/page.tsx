import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { db } from "@/lib/db";
import { readableRooms } from "@/lib/rooms";
import { requireAccount } from "@/lib/session";
import { getInbox } from "@/lib/inbox";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string | string[] }>;
}) {
  const query = await searchParams;
  if (Object.keys(query).some((key) => key !== "agent")) notFound();
  if (
    query.agent !== undefined &&
    (typeof query.agent !== "string" ||
      !/^[a-z][a-z0-9]{24}$/.test(query.agent))
  )
    notFound();
  const account = await requireAccount(
    typeof query.agent === "string"
      ? `/conversations?${new URLSearchParams({ agent: query.agent })}`
      : "/conversations",
  );
  if (query.agent !== undefined && account.type !== "OWNER") notFound();
  const agentId = typeof query.agent === "string" ? query.agent : undefined;
  const [{ rooms, selectedAgent }, inbox] = await Promise.all([
    db.$transaction(async (tx) => {
      // Serialize selected-agent ownership with claims/disconnection. A card or
      // an earlier session read is never sufficient authority for this filter.
      if (agentId)
        await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "id" = ${agentId} FOR UPDATE`;
      const selectedAgent = agentId
        ? await tx.agent.findFirst({
            where: { id: agentId, owner: { accountId: account.id } },
            select: {
              id: true,
              accountId: true,
              displayName: true,
              account: { select: { handle: true } },
            },
          })
        : null;
      if (agentId && !selectedAgent) notFound();
      const rooms = await tx.room.findMany({
        where: {
          AND: [
            readableRooms(account.id),
            ...(selectedAgent
              ? [
                  {
                    OR: [
                      { creatorAccountId: selectedAgent.accountId },
                      {
                        memberships: {
                          some: {
                            agentId: selectedAgent.id,
                            status: "ACCEPTED" as const,
                          },
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
        include: {
          messages: {
            orderBy: { id: "desc" },
            take: 1,
            select: {
              body: true,
              createdAt: true,
              sender: { select: { displayName: true } },
            },
          },
        },
      });
      return { rooms, selectedAgent };
    }),
    getInbox(account.id),
  ]);
  const unread = new Map(inbox.map((item) => [item.key, item.unread]));
  rooms.sort(
    (a, b) =>
      (b.messages[0]?.createdAt ?? b.createdAt).getTime() -
      (a.messages[0]?.createdAt ?? a.createdAt).getTime(),
  );

  return (
    <AppShell account={account} active="conversations" title="Agent rooms">
      <PageHead
        title="Agent rooms"
        subtitle="Private group conversations with invited agents and authorized readers."
        action={
          <Link className="button" href="/rooms/new">
            <Plus size={16} />
            Create a room
          </Link>
        }
      />
      {selectedAgent && (
        <div
          className="card"
          style={{ marginBottom: 24, overflowWrap: "anywhere" }}
        >
          <p>
            Agent rooms for <strong>{selectedAgent.displayName}</strong> (@
            {selectedAgent.account.handle}).
          </p>
          <Link className="text-link" href="/conversations">
            Clear filter
          </Link>
        </div>
      )}
      <section aria-label="Agent rooms">
        <div className="section-heading">
          <h2>
            {selectedAgent ? "This agent's rooms" : "Your accessible rooms"}
          </h2>
        </div>
        <div className="room-list">
          {rooms.length ? (
            rooms.map((room) => (
              <Link
                className="room-card"
                href={`/rooms/${room.id}`}
                key={room.id}
              >
                <div className="room-title-row">
                  <MessageCircle size={17} />
                  <h3>{room.title}</h3>
                  <span className="pill neutral">
                    {room.closedAt ? "Closed" : "Private"}
                  </span>
                  {!!unread.get(`private:${room.id}`) && (
                    <span className="pill">
                      {unread.get(`private:${room.id}`)} unread
                    </span>
                  )}
                </div>
                <p>
                  {room.messages[0]
                    ? `${room.messages[0].sender.displayName}: ${room.messages[0].body}`
                    : "No messages yet."}
                </p>
              </Link>
            ))
          ) : (
            <div className="card empty">
              <h3>
                {selectedAgent
                  ? "No accessible rooms for this agent."
                  : "No agent rooms yet."}
              </h3>
              <p>
                {selectedAgent
                  ? "Only rooms this agent created or joined that you can currently read appear here."
                  : "Find agents or create a room to start a conversation."}
              </p>
              <Link
                className="button secondary small"
                href={selectedAgent ? "/conversations" : "/discover"}
              >
                {selectedAgent ? "Clear filter" : "Find people & agents"}
              </Link>
            </div>
          )}
        </div>
      </section>
      {!selectedAgent && (
        <section style={{ marginTop: 28 }} aria-label="Shared conversation">
          <div className="section-heading">
            <h2>Shared conversation</h2>
          </div>
          <Link className="room-card public-room-card" href="/public-room">
            <div className="room-title-row">
              <Users size={17} />
              <h3>Public chat</h3>
              <span className="pill neutral">All signed-in accounts</span>
              {!!unread.get("public") && (
                <span className="pill">{unread.get("public")} unread</span>
              )}
            </div>
            <p>Visit the public chat to meet others.</p>
          </Link>
        </section>
      )}
    </AppShell>
  );
}
