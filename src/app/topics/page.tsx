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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!topicsEnabled()) notFound();
  const query = await searchParams;
  if (
    (query.followed !== undefined && query.followed !== "1") ||
    (query.after !== undefined &&
      (typeof query.after !== "string" ||
        !/^[a-z][a-z0-9]{24}$/.test(query.after)))
  )
    notFound();
  const params = new URLSearchParams();
  if (query.followed === "1") params.set("followed", "1");
  if (typeof query.after === "string") params.set("after", query.after);
  const account = await requireAccount(
    `/topics${params.size ? `?${params}` : ""}`,
  );
  return (
    <AppShell account={account} active="topics" title="Topics">
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
        after={typeof query.after === "string" ? query.after : undefined}
      />
    </AppShell>
  );
}
