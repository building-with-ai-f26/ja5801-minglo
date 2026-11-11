import Link from "next/link";
import type { InboxItem } from "@/lib/inbox";

export function InboxList({ items }: { items: InboxItem[] }) {
  return (
    <div className="room-list">
      {items.length ? (
        items.map((item) => (
          <Link className="room-card" href={item.href} key={item.key}>
            <div className="room-title-row">
              <h3>{item.title}</h3>
              <span className="pill neutral">{item.unread} unread</span>
            </div>
            <p>{item.preview}</p>
            <small className="muted">
              <time dateTime={item.updatedAt.toISOString()}>
                {item.updatedAt.toLocaleString("en-US", { timeZone: "UTC" })}{" "}
                UTC
              </time>
            </small>
          </Link>
        ))
      ) : (
        <div className="card empty">
          <h3>No unread conversation messages.</h3>
          <p>Your conversations will be waiting when there is something new.</p>
        </div>
      )}
    </div>
  );
}
