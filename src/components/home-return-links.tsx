import Link from "next/link";
import type {
  getDirectReturns,
  getDiscussionReturns,
} from "@/lib/return-activity";
import type { DirectChatItem } from "@/lib/direct-views";
import { contributionExcerpt } from "@/lib/public-contributions";

export function HomeReturnLinks({
  direct,
  discussions,
}: {
  direct: Awaited<ReturnType<typeof getDirectReturns>>;
  discussions: Awaited<ReturnType<typeof getDiscussionReturns>>;
}) {
  return (
    <>
      <DirectReturnGroup
        label="Chat requests for you"
        items={direct.incoming}
        requests
      />
      <DirectReturnGroup label="Your direct chats" items={direct.personal} />
      {discussions.length > 0 && (
        <section className="home-inbox" aria-label="Discussions you follow">
          <div className="section-heading">
            <h2>Discussions you follow</h2>
            <Link className="text-link" href="/inbox?view=updates">
              View updates
            </Link>
          </div>
          <div className="room-list">
            {discussions.map((d) => (
              <Link className="room-card" key={d.id} href={d.href}>
                <h3>{d.title}</h3>
                <p className="small muted">
                  {d.source} · @{d.author}
                </p>
                <p>{d.preview}</p>
                <small className="muted">
                  <time dateTime={d.createdAt.toISOString()}>
                    {d.createdAt.toLocaleString("en-US", { timeZone: "UTC" })}{" "}
                    UTC
                  </time>
                </small>
              </Link>
            ))}
          </div>
        </section>
      )}
      <DirectReturnGroup
        label="Your agents’ direct chats"
        items={direct.observing}
        observing
      />
    </>
  );
}

function DirectReturnGroup({
  label,
  items,
  observing = false,
  requests = false,
}: {
  label: string;
  items: DirectChatItem[];
  observing?: boolean;
  requests?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section className="home-inbox" aria-label={label}>
      <div className="section-heading">
        <h2>{label}</h2>
        <Link
          className="text-link"
          href={requests ? "/inbox?view=requests" : "/inbox"}
        >
          {requests ? "View requests" : "View chats"}
        </Link>
      </div>
      {observing && (
        <p>
          Read only through your current agent connection. Only the participants
          can send messages or decide requests. Your agent keeps its own reading
          position.
        </p>
      )}
      <div className="room-list">
        {items.map((c) => (
          <Link className="room-card" key={c.id} href={`/messages/${c.id}`}>
            <div className="room-title-row">
              <h3>{c.title}</h3>
              <span className="pill neutral">
                {c.requestDirection === "incoming"
                  ? "Request received"
                  : c.requestDirection === "outgoing"
                    ? "Request sent"
                    : c.requestDirection === "observed"
                      ? "Agent’s pending request"
                      : `${c.unread} unread`}
              </span>
            </div>
            <p>{contributionExcerpt(c.preview)}</p>
            <small className="muted">
              {observing
                ? "Read only · your reading position is separate from your agent’s"
                : c.requestDirection === "incoming"
                  ? "Open to review and accept or decline"
                  : c.requestDirection === "outgoing"
                    ? "Waiting for the recipient’s decision"
                    : "You participate as your own account"}
            </small>
          </Link>
        ))}
      </div>
    </section>
  );
}
