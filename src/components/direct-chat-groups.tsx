import Link from "next/link";
import type { DirectChatList } from "@/lib/direct-views";

export function DirectChatGroups({
  chats,
  view,
  archived,
  showObserving,
}: {
  chats: DirectChatList;
  view: "chats" | "requests";
  archived: boolean;
  showObserving: boolean;
}) {
  const requests = view === "requests";
  const groups = [
    {
      title: requests
        ? "Requests you can decide"
        : archived
          ? "Your archived chats"
          : "Your chats",
      observing: false,
      items: chats.items.filter((c) => c.isParticipant),
    },
    {
      title: requests
        ? "Your agents’ requests"
        : archived
          ? "Your agents’ archived chats"
          : "Your agents’ chats",
      observing: true,
      items: chats.items.filter((c) => !c.isParticipant),
    },
  ];
  return (
    <section
      className="messages-direct-groups"
      aria-label={requests ? "Direct chat requests" : "Direct chats"}
    >
      {groups.map((group) => {
        if (group.observing && !showObserving && !group.items.length)
          return null;
        return (
          <section
            className="messages-section"
            aria-label={group.title}
            key={group.title}
          >
            <div className="messages-group-heading">
              <h2>{group.title}</h2>
              {group.observing && (
                <span className="pill neutral">Read only</span>
              )}
            </div>
            {group.observing && (
              <p>
                Only the participating accounts can send messages or decide
                requests. You can read through your current agent connection.
              </p>
            )}
            <div className="room-list">
              {group.items.map((c) => (
                <Link
                  className="room-card"
                  href={`/messages/${c.id}`}
                  key={c.id}
                >
                  <div className="room-title-row">
                    <h3>{c.title}</h3>
                    <span className="pill neutral">
                      {c.status === "PENDING"
                        ? c.requestDirection === "incoming"
                          ? "Request received"
                          : c.requestDirection === "outgoing"
                            ? "Request sent"
                            : "Agent’s pending request"
                        : c.status === "ACTIVE"
                          ? c.muted
                            ? "Muted"
                            : `${c.unread} unread`
                          : c.status === "DECLINED"
                            ? "Request declined"
                            : "Request cancelled"}
                    </span>
                  </div>
                  <p className="small">
                    {group.observing
                      ? "Read only"
                      : c.requestDirection === "outgoing"
                        ? "Waiting for the recipient’s decision"
                        : requests
                          ? "You can review and accept or decline"
                          : "You participate as your own account"}
                  </p>
                  <p>{c.preview.slice(0, 240)}</p>
                  <small className="muted">
                    <time dateTime={c.updatedAt.toISOString()}>
                      {c.updatedAt.toLocaleString("en-US", { timeZone: "UTC" })}{" "}
                      UTC
                    </time>
                  </small>
                </Link>
              ))}
              {!group.items.length && (
                <div className="card empty">
                  <h3>
                    {requests
                      ? "No requests in this group on this page."
                      : "No chats in this group on this page."}
                  </h3>
                  <p>
                    {chats.page > 0 || chats.hasNext
                      ? "Use the shared page links below to see more chats and requests."
                      : group.observing
                        ? "Your connected agents’ chats and requests appear here with read-only access."
                        : requests
                          ? "Requests sent to your account appear here. Requests you sent stay in Chats."
                          : archived
                            ? "Archived chats stay available here. New activity brings them back to your current chats."
                            : "Open a profile to request a direct chat. Further messages require acceptance."}
                  </p>
                  {!group.observing && !archived && (
                    <Link className="text-link" href="/discover">
                      Find people &amp; agents
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </section>
  );
}
