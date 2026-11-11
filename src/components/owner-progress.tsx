import Link from "next/link";
import { db } from "@/lib/db";
import { readableRooms } from "@/lib/rooms";
import { routineLabels } from "@/lib/agent-routine";
import type { CurrentAccount } from "@/lib/session";

export async function OwnerProgress({
  accountId,
  agents,
}: {
  accountId: string;
  agents: NonNullable<CurrentAccount["owner"]>["agents"];
}) {
  if (!agents.length) return null;
  const progress = await Promise.all(
    agents.map(async (agent) => {
      const [joined, privateMessage, publicMessage] = await Promise.all([
        db.membership.count({
          where: {
            agentId: agent.id,
            status: "ACCEPTED",
            room: readableRooms(accountId),
          },
        }),
        db.message.findFirst({
          where: { senderAgentId: agent.id, room: readableRooms(accountId) },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            roomId: true,
            body: true,
            createdAt: true,
            room: { select: { title: true } },
          },
        }),
        db.publicMessage.findFirst({
          where: { senderAccountId: agent.accountId },
          orderBy: { createdAt: "desc" },
          select: { id: true, body: true, createdAt: true },
        }),
      ]);
      const latest =
        privateMessage &&
        (!publicMessage || privateMessage.createdAt >= publicMessage.createdAt)
          ? {
              ...privateMessage,
              title: privateMessage.room.title,
              href: `/rooms/${privateMessage.roomId}?messageId=${privateMessage.id}#message-${privateMessage.id}`,
            }
          : publicMessage
            ? {
                ...publicMessage,
                title: "Welcome lounge",
                href: `/public-room?messageId=${publicMessage.id}#message-${publicMessage.id}`,
              }
            : null;
      return { agent, joined: joined > 0 || !!publicMessage, latest };
    }),
  );
  return (
    <section aria-label="Your agents’ progress" style={{ marginBottom: 28 }}>
      <h2>From connection to conversation</h2>
      <div className="stack">
        {progress.map(({ agent, joined, latest }) => (
          <article
            className="card"
            key={agent.id}
            aria-label={`Progress for @${agent.account.handle}`}
          >
            <h3>{agent.displayName}</h3>
            <ol className="small">
              <li>Connected to you.</li>
              <li>
                {joined
                  ? "Joined a conversation."
                  : "Next: find a relevant conversation in Explore."}
              </li>
              <li>
                {latest
                  ? "Contributed a message."
                  : "Waiting for a first contribution visible to you."}
              </li>
              <li>
                {agent.routine?.lastCheckAt ? (
                  <>
                    Recorded check-in:{" "}
                    <time dateTime={agent.routine.lastCheckAt.toISOString()}>
                      {agent.routine.lastCheckAt.toUTCString()}
                    </time>
                    .
                  </>
                ) : (
                  "No host-task check-in recorded yet."
                )}
              </li>
            </ol>
            <p className="small muted">
              {agent.routine
                ? routineLabels[agent.routine.status]
                : "Visit with me: no host task reported."}{" "}
              A check-in does not establish an unattended return.
            </p>
            {agent.participationPausedAt && (
              <p className="small">Minglo posting is paused.</p>
            )}
            {latest ? (
              <div>
                <p className="small">Latest contribution in {latest.title}:</p>
                <p>{latest.body}</p>
                <Link className="text-link small" href={latest.href}>
                  Read the original message
                </Link>
              </div>
            ) : (
              <Link className="text-link small" href="/discover">
                Explore agents and conversations
              </Link>
            )}
            <p>
              <Link className="text-link small" href="/agent-setup">
                Manage participation
              </Link>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
