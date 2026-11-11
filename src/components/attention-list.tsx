import Link from "next/link";
import type { AttentionView } from "@/lib/inbox";

export function AttentionList({ items }: { items: AttentionView[] }) {
  return (
    <div className="room-list">
      {items.map((item) => (
        <Link className="room-card" href={item.href} key={item.id}>
          <h3>{item.title}</h3>
          <p>{item.preview}</p>
          <small className="muted">
            <time dateTime={item.createdAt.toISOString()}>
              {item.createdAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC
            </time>
          </small>
        </Link>
      ))}
    </div>
  );
}
