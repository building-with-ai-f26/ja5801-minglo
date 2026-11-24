import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { getProjectReturns } from "@/lib/projects";
import { ProjectRows } from "@/components/project-returns";
import { workspaceQueue } from "@/lib/projects/queries";
import { safeNext } from "@/lib/validation";
import { requireAccount } from "@/lib/session";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    after?: string;
    inviteAfter?: string;
    workAfter?: string;
    decisionAfter?: string;
  }>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== "string") notFound();
    params.set(key, value);
  }
  function page(changes: Record<string, string | null>) {
    const revised = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) revised.set(key, value);
      else revised.delete(key);
    }
    return "/projects" + (revised.size ? `?${revised}` : "");
  }
  const path = page({});
  if (safeNext(path) !== path) notFound();
  const account = await requireAccount(path);
  const [{ items, next }, invitations, queue] = await Promise.all([
    getProjectReturns(account.id, {
      all: true,
      after: query.after,
      kind: "memberships",
    }),
    getProjectReturns(account.id, {
      all: true,
      after: query.inviteAfter,
      kind: "invitations",
    }),
    workspaceQueue(account.id, query),
  ]);
  return (
    <AppShell account={account} active="projects" title={null}>
      <div className="project-workspace">
        <Link className="text-link" href="/dashboard">
          Back to Home
        </Link>
        <PageHead
          title="Your projects"
          action={
            account.type === "OWNER" && (
              <Link className="button" href="/projects/new">
                Start a project
              </Link>
            )
          }
        />
        {(invitations.items.length > 0 || query.inviteAfter) && (
          <section className="card project-panel">
            <h2>Invitations</h2>
            <ProjectRows items={invitations.items} />
            <div className="project-links">
              {query.inviteAfter && (
                <Link className="text-link" href={page({ inviteAfter: null })}>
                  First invitations page
                </Link>
              )}
              {invitations.next && (
                <Link
                  className="text-link"
                  href={page({ inviteAfter: invitations.next })}
                >
                  More invitations
                </Link>
              )}
            </div>
          </section>
        )}
        {(queue.decisions.length > 0 || query.decisionAfter) && (
          <section className="card project-panel">
            <h2>Needs my decision</h2>
            <ProjectRows items={queue.decisions} />
            <nav className="project-links" aria-label="Decision pages">
              {query.decisionAfter && (
                <Link
                  className="text-link"
                  href={page({ decisionAfter: null })}
                >
                  First decisions page
                </Link>
              )}
              {queue.decisionNext && (
                <Link
                  className="text-link"
                  href={page({ decisionAfter: queue.decisionNext })}
                >
                  More decisions
                </Link>
              )}
            </nav>
          </section>
        )}
        {(queue.work.length > 0 || query.workAfter) && (
          <section className="card project-panel">
            {queue.work.some((item) => item.kind !== "waiting") && (
              <>
                <h2>My work</h2>
                <ProjectRows
                  items={queue.work.filter((item) => item.kind !== "waiting")}
                />
              </>
            )}
            {queue.work.some((item) => item.kind === "waiting") && (
              <>
                <h2>Waiting on others</h2>
                <ProjectRows
                  items={queue.work.filter((item) => item.kind === "waiting")}
                />
              </>
            )}
            <nav className="project-links" aria-label="My work pages">
              {query.workAfter && (
                <Link className="text-link" href={page({ workAfter: null })}>
                  First work page
                </Link>
              )}
              {queue.workNext && (
                <Link
                  className="text-link"
                  href={page({ workAfter: queue.workNext })}
                >
                  More work
                </Link>
              )}
            </nav>
          </section>
        )}
        <div className="card project-panel">
          <h2>Project list</h2>
          {items.length ? (
            <ul className="project-list">
              {items.map((item) => (
                <li key={item.id}>
                  <Link className="text-link" href={item.href}>
                    {item.label}
                  </Link>
                  {"status" in item && (
                    <span className="muted">{item.status}</span>
                  )}
                  {"action" in item && item.action && (
                    <Link className="text-link" href={item.action.href}>
                      {item.action.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>There are no projects to show on this page.</p>
          )}
          <nav className="project-links" aria-label="Project pages">
            {query.after && (
              <Link className="text-link" href={page({ after: null })}>
                First page
              </Link>
            )}
            {next && (
              <Link className="text-link" href={page({ after: next })}>
                Next page
              </Link>
            )}
          </nav>
        </div>
      </div>
    </AppShell>
  );
}
