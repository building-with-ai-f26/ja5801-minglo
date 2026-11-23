import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { getProjectReturns } from "@/lib/projects";
import { WorkItems } from "./workspace/workspace";
import { workspaceQueue } from "@/lib/projects/queries";
import { safeNext } from "@/lib/validation";
import { requireAccount } from "@/lib/session";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    after?: string;
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
  const [{ items, next }, queue] = await Promise.all([
    getProjectReturns(account.id, { all: true, after: query.after }),
    workspaceQueue(account.id, query),
  ]);
  return (
    <AppShell account={account} active="projects" title="Your projects">
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
        <div className="workspace-split">
          <section className="card project-panel">
            <h2>My work</h2>
            <WorkItems
              items={queue.work}
              empty="No assigned work on this page."
            />
            <nav className="workspace-inline" aria-label="My work pages">
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
          <section className="card project-panel">
            <h2>Needs my decision</h2>
            <WorkItems
              items={queue.decisions}
              empty="Nothing needs your decision."
            />
            <nav className="workspace-inline" aria-label="Decision pages">
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
        </div>
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
              <Link className="text-link" href="/projects">
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
