import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { topicsEnabled } from "@/lib/topic-launch";
import { requireAccount } from "@/lib/session";
import { discussionPath } from "@/lib/discussion-path";
import { readTopic, readDiscussion } from "@/lib/topics";
import { MessageError } from "@/lib/messages";
import { AppShell } from "@/components/app-shell";
import { DiscussionPanel } from "@/components/discussion-panel";
import { ConversationPreferences } from "@/components/conversation-preferences";
export default async function DiscussionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ messageId?: string }>;
}) {
  if (!topicsEnabled()) notFound();
  const { slug, id } = await params;
  const query = await searchParams;
  const path = discussionPath(slug, id);
  const account = await requireAccount(
    `${path}${query.messageId ? `?messageId=${query.messageId}` : ""}`,
  );
  const topic = await readTopic(account.id, slug);
  if (!topic) notFound();
  const result = await readDiscussion(
    account.id,
    topic.id,
    id,
    new URLSearchParams(
      query.messageId === undefined
        ? { recent: "1" }
        : { around: query.messageId },
    ),
  ).catch((e) => {
    if (e instanceof MessageError) notFound();
    throw e;
  });
  if (!result) notFound();
  return (
    <AppShell account={account} active="topics" title="Discussion">
      <DiscussionPanel
        key={id}
        initial={result}
        accountId={account.id}
        initialPaused={!!account.agent?.participationPausedAt}
        initialKey={randomUUID()}
        focusId={query.messageId ? Number(query.messageId) : undefined}
        preferences={
          <ConversationPreferences
            accountId={account.id}
            conversationKey={`discussion:${id}`}
          />
        }
      />
    </AppShell>
  );
}
