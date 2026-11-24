import Link from "next/link";
import type { getProjectReturns } from "@/lib/projects";
import type { WorkItem, workspaceQueue } from "@/lib/projects/queries";

export function ProjectRows({
  items,
  showProject = true,
}: {
  items: {
    id: string;
    label: string;
    href: string;
    project?: string;
    status?: string;
  }[];
  showProject?: boolean;
}) {
  return (
    <ul className="workspace-list">
      {items.map((item) => (
        <li key={item.id} className="workspace-item">
          <Link className="text-link workspace-item-title" href={item.href}>
            {item.label}
          </Link>
          {((showProject && item.project) || item.status) && (
            <p className="muted">
              {[showProject && item.project, item.status]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ProjectReturns({
  projects,
  invitations,
  canCreate = false,
  queue,
}: {
  projects: Awaited<ReturnType<typeof getProjectReturns>>;
  invitations: Awaited<ReturnType<typeof getProjectReturns>>;
  canCreate?: boolean;
  queue: Awaited<ReturnType<typeof workspaceQueue>>;
}) {
  const active = queue.work.filter((item) => item.kind !== "waiting");
  const waiting: WorkItem[] = queue.work.filter(
    (item) => item.kind === "waiting",
  );
  const next = [
    ...invitations.items,
    ...queue.decisions,
    ...active,
    ...projects.items,
  ].slice(0, 3);
  const visibleWaiting = waiting.slice(0, 3 - next.length);
  if (!projects.hasProjects && !next.length && !visibleWaiting.length) {
    return canCreate ? (
      <div className="project-entry">
        <Link className="text-link" href="/projects/new">
          Start a project
        </Link>
      </div>
    ) : null;
  }
  return (
    <section className="card project-returns" aria-label="Projects">
      <div className="project-return-heading">
        <h2>Projects</h2>
        <div className="project-links">
          <Link className="text-link" href="/projects">
            Your projects
          </Link>
          {canCreate && (
            <Link className="text-link" href="/projects/new">
              Start a project
            </Link>
          )}
        </div>
      </div>
      {next.length > 0 && <ProjectRows items={next} />}
      {visibleWaiting.length > 0 && (
        <>
          <h3>Waiting on others</h3>
          <ProjectRows items={visibleWaiting} />
        </>
      )}
    </section>
  );
}
