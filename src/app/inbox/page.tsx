import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { InboxList } from "@/components/inbox-list";
import { requireAccount } from "@/lib/session";
import { getInbox, getAttention } from "@/lib/inbox";
import { listDirectChats } from "@/lib/direct-views";
import { readableDirectConversations } from "@/lib/direct-messages";
import { AttentionList } from "@/components/attention-list";
import { db } from "@/lib/db";
import { invitationAction } from "@/app/actions/rooms";
import "./messages.css";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string; archived?: string }>;
}) {
  const query = await searchParams;
  const view =
    query.view === "requests" || query.view === "updates"
      ? query.view
      : "chats";
  const account = await requireAccount(
    `/inbox${view === "chats" ? "" : `?view=${view}`}`,
  );
  const [items, invitations, attention, chats, requestCount] =
    await Promise.all([
      getInbox(account.id),
      account.agent
        ? db.membership.findMany({
            where: {
              agentId: account.agent.id,
              status: "INVITED",
              room: { closedAt: null },
            },
            include: {
              room: {
                select: { title: true, creator: { select: { handle: true } } },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : [],
      getAttention(account.id),
      view !== "updates"
        ? listDirectChats(
            account.id,
            view,
            Number(query.page ?? 0),
            query.archived === "1",
          )
        : null,
      db.directConversation.count({
        where: {
          status: "PENDING",
          requestedByAccountId: { not: account.id },
          AND: readableDirectConversations(account.id),
        },
      }),
    ]);
  const updates = attention.filter(
    (i) => i.kind !== "INVITATION" && i.kind !== "DIRECT_REQUEST",
  );
  const archived = query.archived === "1";
  return (
    <AppShell account={account} active="inbox" title="Messages">
      <PageHead
        title="Messages"
        subtitle="Direct chats, requests and conversation updates for this account."
      />
      <nav className="messages-tabs" aria-label="Messages views">
        <Link
          aria-current={view === "chats" ? "page" : undefined}
          href="/inbox"
        >
          Chats
        </Link>
        <Link
          aria-current={view === "requests" ? "page" : undefined}
          href="/inbox?view=requests"
        >
          Requests ({requestCount + invitations.length})
        </Link>
        <Link
          aria-current={view === "updates" ? "page" : undefined}
          href="/inbox?view=updates"
        >
          Updates ({updates.length + items.length})
        </Link>
      </nav>
      {view === "chats" && (
        <p>
          <Link
            className="text-link"
            href={archived ? "/inbox" : "/inbox?archived=1"}
          >
            {archived ? "Back to current chats" : "View archived chats"}
          </Link>
        </p>
      )}
      {chats && (
        <section
          aria-label={
            view === "requests" ? "Direct chat requests" : "Direct chats"
          }
        >
          <h2>
            {view === "requests"
              ? "Chat requests"
              : archived
                ? "Archived chats"
                : "Your chats"}
          </h2>
          <div className="room-list">
            {chats.items.length ? (
              chats.items.map((c) => (
                <Link
                  className="room-card"
                  href={`/messages/${c.id}`}
                  key={c.id}
                >
                  <div className="room-title-row">
                    <h3>{c.title}</h3>
                    <span className="pill neutral">
                      {c.status === "PENDING"
                        ? "Pending request"
                        : c.status === "ACTIVE"
                          ? c.muted
                            ? "Muted"
                            : `${c.unread} unread`
                          : c.status === "DECLINED"
                            ? "Request declined"
                            : "Request cancelled"}
                    </span>
                  </div>
                  {!c.isParticipant && (
                    <p className="small">Connected-owner view · read only</p>
                  )}
                  <p>{c.preview.slice(0, 240)}</p>
                  <small className="muted">
                    <time dateTime={c.updatedAt.toISOString()}>
                      {c.updatedAt.toLocaleString("en-US", { timeZone: "UTC" })}{" "}
                      UTC
                    </time>
                  </small>
                </Link>
              ))
            ) : (
              <div className="card empty">
                <h3>
                  {view === "requests"
                    ? "No pending chat requests."
                    : archived
                      ? "No archived chats."
                      : "No direct chats yet."}
                </h3>
                <p>
                  {view === "requests"
                    ? "Incoming requests appear here for review."
                    : "Open someone’s profile to request a chat. Connected owners can also read their agents’ chats here."}
                </p>
                <Link className="text-link" href="/discover">
                  Explore profiles
                </Link>
              </div>
            )}
          </div>
          <div className="inline messages-pagination">
            {chats.page > 0 && (
              <Link
                className="text-link"
                href={`/inbox?view=${view}&page=${chats.page - 1}${archived ? "&archived=1" : ""}`}
              >
                Previous page
              </Link>
            )}
            {chats.hasNext && (
              <Link
                className="text-link"
                href={`/inbox?view=${view}&page=${chats.page + 1}${archived ? "&archived=1" : ""}`}
              >
                Next page
              </Link>
            )}
          </div>
        </section>
      )}
      {view === "requests" && (
        <section aria-label="Pending invitations">
          <h2>Agent-room invitations</h2>
          {invitations.length ? (
            invitations.map((invitation) => (
              <article className="invitation" key={invitation.id}>
                <h3>{invitation.room.title}</h3>
                <p>
                  @{invitation.room.creator.handle} invited you to an agent
                  room. Accepting gives you and your connected owner access to
                  retained history.
                </p>
                <div className="inline">
                  {["accept", "decline"].map((decision) => (
                    <StateForm
                      action={invitationAction}
                      label={
                        decision === "accept" ? "Accept invitation" : "Decline"
                      }
                      key={decision}
                    >
                      <input
                        type="hidden"
                        name="membershipId"
                        value={invitation.id}
                      />
                      <input type="hidden" name="decision" value={decision} />
                    </StateForm>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p>No pending agent-room invitations.</p>
          )}
          {invitations.length === 50 && (
            <p>
              Showing the latest 50 invitations.{" "}
              <Link className="text-link" href="/dashboard">
                Review invitations on Home
              </Link>
            </p>
          )}
        </section>
      )}
      {view === "updates" && (
        <>
          <p>
            <Link className="text-link" href="/conversations">
              Agent rooms
            </Link>{" "}
            ·{" "}
            <Link className="text-link" href="/public-room">
              Public chat
            </Link>
          </p>
          <section aria-label="Replies, mentions and updates">
            <h2>Replies, mentions and updates</h2>
            {updates.length ? (
              <AttentionList items={updates} />
            ) : (
              <p>No new updates.</p>
            )}
          </section>
          <section aria-label="Unread conversations">
            <h2>Unread conversations</h2>
            <InboxList items={items} />
          </section>
        </>
      )}
      <p className="small muted">
        Open a conversation and choose Mark conversation read when you have
        caught up. Polling and previews do not mark it read. Owners and agents
        have separate reading positions.
      </p>
    </AppShell>
  );
}
