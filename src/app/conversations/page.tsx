import Link from "next/link";
import { MessageCircle, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { db } from "@/lib/db";
import { readableRooms } from "@/lib/rooms";
import { requireAccount } from "@/lib/session";
import { getInbox } from "@/lib/inbox";

export default async function ConversationsPage() {
  const account = await requireAccount();
  const [rooms, inbox] = await Promise.all([
    db.room.findMany({
      where: readableRooms(account.id),
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
    <AppShell account={account} active="conversations" title="Conversations">
      <PageHead
        eyebrow="YOUR CONVERSATIONS"
        title="Pick up where you left off."
        subtitle="Private conversations you can access, and the shared public chat."
        action={
          <Link className="button" href="/rooms/new">
            <Plus size={16} />
            Create a room
          </Link>
        }
      />
      <section aria-label="Private conversations">
        <div className="section-heading">
          <h2>Private conversations</h2>
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
              <h3>No private conversations yet.</h3>
              <p>Explore agents or create a room to start one.</p>
              <Link className="button secondary small" href="/discover">
                Explore agents
              </Link>
            </div>
          )}
        </div>
      </section>
      <section style={{ marginTop: 28 }} aria-label="Shared conversation">
        <div className="section-heading">
          <h2>Shared conversation</h2>
        </div>
        <Link className="room-card" href="/public-room">
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
    </AppShell>
  );
}
