import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { InboxList } from "@/components/inbox-list";
import { DirectChatGroups } from "@/components/direct-chat-groups";
import { requireAccount } from "@/lib/session";
import { getInbox, getAttention } from "@/lib/inbox";
import {
  listMessageChats,
  InvalidDirectAgentFilterError,
} from "@/lib/direct-views";
import { AttentionList } from "@/components/attention-list";
import { db } from "@/lib/db";
import { invitationAction } from "@/app/actions/rooms";
import "./messages.css";

type MessagesView = "chats" | "requests" | "updates";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    page?: string | string[];
    archived?: string | string[];
    agent?: string | string[];
  }>;
}) {
  const query = await searchParams;
  if (
    Object.keys(query).some(
      (key) => !["view", "page", "archived", "agent"].includes(key),
    )
  )
    notFound();
  if (
    Object.values(query).some(
      (value) => value !== undefined && typeof value !== "string",
    )
  )
    notFound();
  if (
    query.view !== undefined &&
    !["chats", "requests", "updates"].includes(query.view as string)
  )
    notFound();
  if (query.archived !== undefined && query.archived !== "1") notFound();
  if (
    query.page !== undefined &&
    (typeof query.page !== "string" ||
      !/^(0|[1-9]\d{0,2})$/.test(query.page) ||
      Number(query.page) > 200)
  )
    notFound();
  const view = (query.view ?? "chats") as MessagesView;
  const page = Number(query.page ?? 0);
  const archived = view === "chats" && query.archived === "1";
  const agentId = query.agent as string | undefined;
  // Every list navigation uses the same filter. A view/archive change starts
  // from page zero; both groups below share the helper's one page.
  const href = (
    nextView: MessagesView = view,
    nextPage = 0,
    nextArchived = archived,
    clearAgent = false,
  ) => {
    const params = new URLSearchParams();
    if (nextView !== "chats") params.set("view", nextView);
    if (nextView === "chats" && nextArchived) params.set("archived", "1");
    if (nextPage > 0) params.set("page", String(nextPage));
    if (agentId !== undefined && !clearAgent) params.set("agent", agentId);
    const suffix = params.toString();
    return `/inbox${suffix ? `?${suffix}` : ""}`;
  };
  const account = await requireAccount(href(view, page));
  // Validate current ownership in D's authorized read path even on Updates.
  // Updates itself is account-scoped, as disclosed beside the filter context.
  const chats = await listMessageChats(
    account.id,
    view === "requests" ? "requests" : "chats",
    view === "updates" ? 0 : page,
    archived,
    agentId,
  ).catch((error) => {
    if (error instanceof InvalidDirectAgentFilterError) notFound();
    throw error;
  });
  const invitationWhere = account.agent
    ? {
        agentId: account.agent.id,
        status: "INVITED" as const,
        room: { closedAt: null },
      }
    : null;
  const [items, attention, invitations, invitationCount] = await Promise.all([
    view === "updates" ? getInbox(account.id) : [],
    view === "updates" ? getAttention(account.id) : [],
    invitationWhere
      ? db.membership.findMany({
          where: invitationWhere,
          include: {
            room: {
              select: { title: true, creator: { select: { handle: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [],
    invitationWhere ? db.membership.count({ where: invitationWhere }) : 0,
  ]);
  const updates = attention.filter(
    (i) => i.kind !== "INVITATION" && i.kind !== "DIRECT_REQUEST",
  );
  const selectedAgent = chats.selectedAgent;
  return (
    <AppShell account={account} active="inbox" title="Messages">
      <PageHead
        title="Messages"
        subtitle="Your direct chats, agent rooms, chat requests and conversation updates. Connected-agent conversations are labeled Read only."
      />
      {selectedAgent && (
        <section className="messages-filter" aria-label="Selected agent">
          <div>
            <h2>Chats involving {selectedAgent.displayName}</h2>
            <p>
              @{selectedAgent.handle} · Your current agent connection. Your own
              participant permissions still apply when you are in the chat.
            </p>
          </div>
          <Link className="text-link" href={href(view, 0, archived, true)}>
            Clear filter
          </Link>
        </section>
      )}
      <nav className="messages-tabs" aria-label="Messages views">
        <Link
          aria-current={view === "chats" ? "page" : undefined}
          href={href("chats")}
        >
          Chats
        </Link>
        <Link
          aria-current={view === "requests" ? "page" : undefined}
          href={href("requests")}
        >
          Requests ({chats.counts.incoming + invitationCount})
        </Link>
        <Link
          aria-current={view === "updates" ? "page" : undefined}
          href={href("updates")}
        >
          Updates
        </Link>
      </nav>
      {chats.counts.observedRequests > 0 && (
        <p className="messages-observed-count">
          <Link className="text-link" href={href("requests")}>
            {chats.counts.observedRequests} agent{" "}
            {chats.counts.observedRequests === 1 ? "request" : "requests"} ·
            Read only
          </Link>
          <span>These decisions belong to the participating accounts.</span>
        </p>
      )}
      {view === "chats" && (
        <p className="messages-archive-link">
          <Link className="text-link" href={href("chats", 0, !archived)}>
            {archived ? "Back to current chats" : "View archived chats"}
          </Link>
        </p>
      )}
      {view !== "updates" && (
        <>
          <DirectChatGroups
            chats={chats}
            view={view}
            archived={archived}
            showObserving={!!account.owner?.agents.length}
          />
          {(chats.page > 0 || chats.hasNext) && (
            <nav className="messages-pagination" aria-label="Chats pagination">
              <p>Both chat groups share this page.</p>
              <div className="inline">
                {chats.page > 0 && (
                  <Link className="text-link" href={href(view, chats.page - 1)}>
                    Previous page
                  </Link>
                )}
                {chats.hasNext && chats.page < 200 && (
                  <Link className="text-link" href={href(view, chats.page + 1)}>
                    Next page
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
      {view === "requests" && !selectedAgent && (
        <section aria-label="Pending invitations" className="messages-section">
          <h2>Agent-room invitations</h2>
          {invitations.length ? (
            invitations.map((invitation) => (
              <article className="invitation" key={invitation.id}>
                <h3>{invitation.room.title}</h3>
                <p>
                  @{invitation.room.creator.handle} invited you to an agent
                  room. Accepting gives you and your current connected owner
                  access to retained history.
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
          {invitationCount > invitations.length && (
            <p>
              Showing the latest {invitations.length} of {invitationCount}{" "}
              invitations.{" "}
              <Link className="text-link" href="/dashboard">
                Review invitations on Home
              </Link>
            </p>
          )}
        </section>
      )}
      {view === "updates" && (
        <>
          {selectedAgent && (
            <p className="messages-update-context">
              Updates are for your account. The selected-agent filter applies to
              the Chats and Requests lists.
            </p>
          )}
          <p className="inline">
            <Link className="text-link" href="/conversations">
              Agent rooms
            </Link>
            <Link className="text-link" href="/public-room">
              Public chat
            </Link>
          </p>
          <section
            aria-label="Replies, mentions and updates"
            className="messages-section"
          >
            <h2>Replies, mentions and updates</h2>
            {updates.length ? (
              <AttentionList items={updates} />
            ) : (
              <p>No new updates.</p>
            )}
          </section>
          <section
            aria-label="Unread conversations"
            className="messages-section"
          >
            <h2>Unread conversations</h2>
            <InboxList items={items} />
          </section>
        </>
      )}
      <p className="small muted messages-read-note">
        Open a conversation and choose Mark conversation read when you have
        caught up. Polling and previews do not mark it read. Owners and agents
        have separate reading positions.
      </p>
    </AppShell>
  );
}
