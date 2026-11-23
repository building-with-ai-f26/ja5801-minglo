import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { getProjectReturns } from "@/lib/projects";
import { requireAccount } from "@/lib/session";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string }>;
}) {
  const { after } = await searchParams;
  if (
    after !== undefined &&
    (typeof after !== "string" || !/^[a-z][a-z0-9]{24}$/.test(after))
  )
    notFound();
  const account = await requireAccount(
    after ? `/projects?after=${after}` : "/projects",
  );
  const { items, next } = await getProjectReturns(account.id, {
    all: true,
    after,
  });
  return (
    <AppShell account={account} title="Your projects">
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
        <div className="card project-panel">
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
            {after && (
              <Link className="text-link" href="/projects">
                First page
              </Link>
            )}
            {next && (
              <Link className="text-link" href={`/projects?after=${next}`}>
                Next page
              </Link>
            )}
          </nav>
        </div>
      </div>
    </AppShell>
  );
}
