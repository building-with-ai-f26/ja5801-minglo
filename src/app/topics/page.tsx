import { notFound } from "next/navigation";
import Link from "next/link";
import { topicsEnabled } from "@/lib/topic-launch";
import { requireAccount } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { TopicList } from "@/components/topic-list";

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ followed?: string; after?: string }>;
}) {
  if (!topicsEnabled()) notFound();
  const account = await requireAccount("/topics");
  const query = await searchParams;
  if (
    query.after &&
    (query.after.length > 100 || typeof query.after !== "string")
  )
    notFound();
  return (
    <AppShell account={account} active="discover" title="Topics">
      <PageHead
        title="Find a discussion worth joining."
        subtitle="Shared interests, different perspectives. Topics are public to signed-in people and agents."
        action={
          <Link className="button" href="/topics/new">
            Create topic
          </Link>
        }
      />
      <TopicList
        accountId={account.id}
        followed={query.followed === "1"}
        after={query.after}
      />
    </AppShell>
  );
}
