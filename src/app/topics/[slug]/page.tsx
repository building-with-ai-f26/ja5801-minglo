import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/session";
import { topicsEnabled } from "@/lib/topic-launch";
import { readTopic, listDiscussions } from "@/lib/topics";
import { MessageError } from "@/lib/messages";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { topicFollowAction } from "@/app/actions/topics";

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; cursor?: string }>;
}) {
  if (!topicsEnabled()) notFound();
  const { slug } = await params;
  const account = await requireAccount(`/topics/${slug}`);
  const topic = await readTopic(account.id, slug);
  if (!topic) notFound();
  const query = await searchParams;
  const sort = query.sort === "newest" ? "newest" : "recent";
  const result = await listDiscussions(account.id, topic.id, {
    sort,
    cursor: query.cursor,
  }).catch((e) => {
    if (e instanceof MessageError && e.status === 400) notFound();
    throw e;
  });
  return (
    <AppShell account={account} active="discover" title="Topics">
      <p>
        <Link className="text-link" href="/topics">
          All topics
        </Link>
      </p>
      <PageHead
        title={topic.name}
        subtitle={topic.description}
        action={
          !topic.archivedAt && (
            <Link className="button" href={`/topics/${slug}/new`}>
              Start discussion
            </Link>
          )
        }
      />
      {topic.archivedAt && (
        <p className="notice" role="status">
          This topic is archived. History is available; new discussions and
          replies are closed.
        </p>
      )}
      <div className="card topic-overview">
        <div>
          <h2>About this topic</h2>
          <p className="topic-rules">{topic.rules}</p>
          <p className="small">
            Public to all signed-in accounts. Keep private owner information out
            of your contributions.
          </p>
        </div>
        <StateForm
          action={topicFollowAction}
          label={topic.follows.length ? "Unfollow topic" : "Follow topic"}
        >
          <input type="hidden" name="slug" value={slug} />
          <input
            type="hidden"
            name="intent"
            value={topic.follows.length ? "unfollow" : "follow"}
          />
        </StateForm>
      </div>
      <nav className="topic-filters" aria-label="Discussion order">
        <Link
          aria-current={sort === "recent" ? "page" : undefined}
          href={`/topics/${slug}`}
        >
          Recent activity
        </Link>
        <Link
          aria-current={sort === "newest" ? "page" : undefined}
          href={`/topics/${slug}?sort=newest`}
        >
          Newest discussions
        </Link>
      </nav>
      {result.threads.length ? (
        <section className="card topic-directory" aria-label="Discussions">
          {result.threads.map((thread) => (
            <article className="topic-row" key={thread.id}>
              <div>
                <h2>
                  <Link href={`/topics/${slug}/discussions/${thread.id}`}>
                    {thread.title}
                  </Link>
                </h2>
                <p className="topic-excerpt">
                  {thread.opening?.hidden
                    ? "The opening contribution is unavailable."
                    : thread.opening?.body?.slice(0, 240)}
                </p>
                <p className="topic-meta">
                  <Link href={`/profiles/${thread.creator.handle}`}>
                    @{thread.creator.handle}
                  </Link>{" "}
                  · {thread.replyCount}{" "}
                  {thread.replyCount === 1 ? "reply" : "replies"}
                  {thread.lockedAt ? " · Replies locked" : ""}
                </p>
                <p className="small muted">
                  Last contribution{" "}
                  <time dateTime={thread.lastActivityAt.toISOString()}>
                    {thread.lastActivityAt.toLocaleString("en-US", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </p>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="card empty">
          <h2>No discussions here yet.</h2>
          <p>
            {topic.archivedAt
              ? "This archived topic has no visible discussions."
              : "Bring a question or an idea that others can respond to."}
          </p>
          {!topic.archivedAt && (
            <Link className="text-link" href={`/topics/${slug}/new`}>
              Start the first discussion
            </Link>
          )}
        </div>
      )}
      {result.next && (
        <p>
          <Link
            className="button secondary"
            href={`/topics/${slug}?sort=${sort}&cursor=${encodeURIComponent(result.next)}`}
          >
            Next discussions
          </Link>
        </p>
      )}
    </AppShell>
  );
}
