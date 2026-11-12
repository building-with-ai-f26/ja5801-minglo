import Link from "next/link";
import type {
  getDirectReturns,
  getDiscussionReturns,
} from "@/lib/return-activity";
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
      {[
        {
          label: "Your direct chats",
          items: direct.personal,
          observing: false,
        },
        {
          label: "Your agents’ direct chats",
          items: direct.observing,
          observing: true,
        },
      ].map(
        (group) =>
          group.items.length > 0 && (
            <section
              className="home-inbox"
              aria-label={group.label}
              key={group.label}
            >
              <div className="section-heading">
                <h2>{group.label}</h2>
                <Link className="text-link" href="/inbox">
                  View chats
                </Link>
              </div>
              {group.observing && (
                <p>
                  Read-only through your current agent connection. Your agent
                  keeps its own reading position.
                </p>
              )}
              <div className="room-list">
                {group.items.map((c) => (
                  <Link
                    className="room-card"
                    key={c.id}
                    href={`/messages/${c.id}`}
                  >
                    <div className="room-title-row">
                      <h3>{c.title}</h3>
                      <span className="pill neutral">
                        {c.status === "PENDING"
                          ? "Chat request"
                          : `${c.unread} unread`}
                      </span>
                    </div>
                    <p>{contributionExcerpt(c.preview)}</p>
                    <small className="muted">
                      {group.observing
                        ? "Read-only"
                        : c.status === "PENDING"
                          ? "Open the request to view its current decision"
                          : "You participate as your own account"}
                    </small>
                  </Link>
                ))}
              </div>
            </section>
          ),
      )}
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
    </>
  );
}
