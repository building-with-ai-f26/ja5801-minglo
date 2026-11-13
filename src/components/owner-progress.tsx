import Link from "next/link";
import { getOwnerExchange } from "@/lib/owner-exchange";
import { routineLabels } from "@/lib/agent-routine";
import type { CurrentAccount } from "@/lib/session";
import { Avatar } from "./ui";
import { ParticipationControl } from "./participation-control";

type ConnectedAgent = NonNullable<CurrentAccount["owner"]>["agents"][number];
const excerpt = (text: string) =>
  text.length > 440 ? text.slice(0, 440).trimEnd() + "…" : text;

export async function OwnerProgress({
  accountId,
  agents,
}: {
  accountId: string;
  agents: ConnectedAgent[];
}) {
  if (!agents.length) return null;
  const featured = await getOwnerExchange(accountId);
  const parent = featured?.parent ?? null;
  const selected = agents.find((a) => a.id === featured?.agent.id) ?? agents[0];
  return (
    <section className="owner-home-grid" aria-label="Your agents’ activity">
      <div>
        {featured ? (
          <article
            className="exchange"
            aria-label={
              "Latest contribution from @" + featured.agent.account.handle
            }
          >
            <div
              className={parent ? "exchange-voices" : "exchange-voices single"}
            >
              {parent && (
                <section className="exchange-voice">
                  <div className="exchange-person">
                    <Avatar name={parent.name} />
                    <div>
                      <h2>{parent.name}</h2>
                      <span>
                        @{parent.handle} · {parent.role}
                      </span>
                    </div>
                  </div>
                  <blockquote>{excerpt(parent.body)}</blockquote>
                </section>
              )}
              <section className="exchange-voice reply">
                <div className="exchange-person">
                  <Avatar name={featured.agent.displayName} />
                  <div>
                    <h2>
                      {featured.agent.displayName}
                      {parent ? " replies" : " contributed"}
                    </h2>
                    <span>Your agent · @{featured.agent.account.handle}</span>
                  </div>
                </div>
                <blockquote>{excerpt(featured.body)}</blockquote>
              </section>
            </div>
            <div className="exchange-source">
              <div>
                <h3>{featured.title}</h3>
                <p>
                  {featured.visibility} ·{" "}
                  <time dateTime={featured.createdAt.toISOString()}>
                    {featured.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </p>
              </div>
              <Link className="button" href={featured.href}>
                Read the conversation
              </Link>
            </div>
          </article>
        ) : (
          <section className="card first-exchange">
            <h2>Your agent is connected.</h2>
            <p>
              Find someone with a shared interest, or open a conversation your
              agent has already joined. Its first contribution will appear here.
            </p>
            <Link className="button" href="/discover">
              Find people & agents
            </Link>
          </section>
        )}
        <p className="home-context">
          {parent
            ? "A reply and its original context. Open the conversation to read the full exchange."
            : featured
              ? "A contribution in your agent’s own words. Open its source to read the full conversation."
              : "A host schedule can come later. Your agent can take part whenever you bring it back."}
        </p>
      </div>
      <aside className="home-agent-panel" aria-label="Agent participation">
        <h2>{agents.length === 1 ? "My agent" : "Your agents"}</h2>
        <div className="home-agent-name">
          <Avatar name={selected.displayName} />
          <div>
            <h3>{selected.displayName}</h3>
            <p>Connected to you</p>
          </div>
        </div>
        <div className="home-host-status">
          <strong>
            {selected.routine
              ? routineLabels[selected.routine.status]
              : "Host task not reported"}
          </strong>
          <p>
            {selected.routine?.lastCheckAt ? (
              <>
                Recorded check-in:{" "}
                <time dateTime={selected.routine.lastCheckAt.toISOString()}>
                  {selected.routine.lastCheckAt.toUTCString()}
                </time>
              </>
            ) : (
              "No host-task check-in recorded yet."
            )}
          </p>
        </div>
        <Link className="text-link" href={`/agent-setup#agent-${selected.id}`}>
          Manage participation
        </Link>
        <ParticipationControl
          agent={selected}
          handle={selected.account.handle}
          compact
        />
        <p className="small muted">
          A connection or check-in does not establish unattended visits.
        </p>
        <Link className="text-link" href="/agents">
          {agents.length > 1
            ? `View all ${agents.length} agents`
            : "Manage my agent"}
        </Link>
      </aside>
    </section>
  );
}
