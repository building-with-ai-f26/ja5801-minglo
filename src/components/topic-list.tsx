import Link from "next/link";
import { topicFollowAction } from "@/app/actions/topics";
import { StateForm } from "./state-form";
import { listTopics } from "@/lib/topics";

export async function TopicList({
  accountId,
  followed,
  after,
  base = "/topics",
}: {
  accountId: string;
  followed: boolean;
  after?: string;
  base?: string;
}) {
  const result = await listTopics(accountId, {
    followed,
    after,
    includeArchived: followed,
  });
  return (
    <>
      <nav className="topic-filters" aria-label="Topic filters">
        <Link aria-current={!followed ? "page" : undefined} href={base}>
          All topics
        </Link>
        <Link
          aria-current={followed ? "page" : undefined}
          href={`${base}${base.includes("?") ? "&" : "?"}followed=1`}
        >
          Followed topics
        </Link>
      </nav>
      {result.topics.length ? (
        <section className="card topic-directory" aria-label="Topics">
          {result.topics.map((topic) => (
            <article className="topic-row" key={topic.id}>
              <div>
                <h2>
                  <Link href={`/topics/${topic.slug}`}>{topic.name}</Link>
                </h2>
                <p>{topic.description}</p>
                <p className="topic-meta">
                  {topic._count.threads}{" "}
                  {topic._count.threads === 1 ? "discussion" : "discussions"}
                  {topic.archivedAt ? " · Archived" : ""}
                </p>
                {topic.threads[0] && (
                  <p className="small">
                    Latest discussion:{" "}
                    <Link
                      className="text-link"
                      href={`/topics/${topic.slug}/discussions/${topic.threads[0].id}`}
                    >
                      {topic.threads[0].title}
                    </Link>
                    {" · "}
                    <time
                      dateTime={topic.threads[0].lastActivityAt.toISOString()}
                    >
                      {topic.threads[0].lastActivityAt.toLocaleString("en-US", {
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </time>
                  </p>
                )}
              </div>
              <StateForm
                action={topicFollowAction}
                label={topic.follows.length ? "Unfollow topic" : "Follow topic"}
              >
                <input type="hidden" name="slug" value={topic.slug} />
                <input
                  type="hidden"
                  name="intent"
                  value={topic.follows.length ? "unfollow" : "follow"}
                />
              </StateForm>
            </article>
          ))}
        </section>
      ) : (
        <div className="card empty">
          <h2>
            {followed ? "No followed topics yet." : "Topics are getting ready."}
          </h2>
          <p>
            {followed
              ? "Follow a topic to keep it here. Follow individual discussions when you want reply updates."
              : "Topics will appear here when the Minglo team opens them. You can meet people in Public chat meanwhile."}
          </p>
          <Link className="text-link" href={followed ? base : "/public-room"}>
            {followed ? "Browse all topics" : "Open Public chat"}
          </Link>
        </div>
      )}
      {result.next && (
        <p>
          <Link
            className="button secondary"
            href={`${base}${base.includes("?") ? "&" : "?"}${followed ? "followed=1&" : ""}after=${encodeURIComponent(result.next)}`}
          >
            Next topics
          </Link>
        </p>
      )}
      <p className="small muted">
        Following a topic saves it here. It does not notify you about every
        discussion.
      </p>
    </>
  );
}
