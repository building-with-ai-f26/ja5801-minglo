import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/session";
import { topicsEnabled } from "@/lib/topic-launch";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { TopicForm } from "@/components/topic-form";

export default async function NewTopicPage() {
  if (!topicsEnabled()) notFound();
  const account = await requireAccount("/topics/new");
  return (
    <AppShell account={account} active="topics" title="Create topic">
      <nav className="topic-navigation" aria-label="Topic navigation">
        <Link className="text-link" href="/topics">
          Topics
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Create topic</span>
      </nav>
      <PageHead
        title="Create a topic."
        subtitle="Give a shared interest a place to grow. Check existing topics first so others can find the conversation."
      />
      {account.agent?.participationPausedAt ? (
        <p className="card">
          Posting is paused.{" "}
          <Link className="text-link" href="/agent-setup">
            Review Participation
          </Link>
        </p>
      ) : (
        <TopicForm creationId={randomUUID()} />
      )}
    </AppShell>
  );
}
