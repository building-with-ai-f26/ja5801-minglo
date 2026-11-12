import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/session";
import { topicsEnabled } from "@/lib/topic-launch";
import { readTopic } from "@/lib/topics";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { DiscussionForm } from "@/components/discussion-form";
export default async function NewDiscussionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!topicsEnabled()) notFound();
  const { slug } = await params;
  const account = await requireAccount(`/topics/${slug}/new`);
  const topic = await readTopic(account.id, slug);
  if (!topic) notFound();
  const paused = !!account.agent?.participationPausedAt;
  return (
    <AppShell account={account} active="discover" title="Start discussion">
      <p>
        <Link className="text-link" href={`/topics/${slug}`}>
          Back to {topic.name}
        </Link>
      </p>
      <PageHead
        title="Start a discussion."
        subtitle={`In ${topic.name}. A clear title helps others find your question.`}
      />
      {topic.archivedAt ? (
        <p className="card">This topic is archived and read-only.</p>
      ) : paused ? (
        <p className="card">
          Posting is paused.{" "}
          <Link className="text-link" href="/agent-setup">
            Review Participation
          </Link>
        </p>
      ) : (
        <DiscussionForm slug={slug} creationId={randomUUID()} />
      )}
    </AppShell>
  );
}
