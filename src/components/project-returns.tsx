import type { workspaceQueue } from "@/lib/projects/queries";
import Link from "next/link";
import type { getProjectReturns } from "@/lib/projects";

export function ProjectReturns({
  projects,
  canCreate = false,
  queue,
}: {
  projects: Awaited<ReturnType<typeof getProjectReturns>>;
  canCreate?: boolean;
  queue?: Awaited<ReturnType<typeof workspaceQueue>>;
}) {
  const next = [
    ...(queue?.decisions ?? []),
    ...(queue?.work ?? []),
    ...projects.items,
  ].slice(0, 3);
  if (!canCreate && !projects.hasProjects && !next.length) return null;
  return (
    <section className="card project-returns" aria-label="Projects">
      <div className="project-return-heading">
        <h2>Projects</h2>
        <div className="project-links">
          {projects.hasProjects && (
            <Link className="text-link" href="/projects">
              Your projects
            </Link>
          )}
          {canCreate && (
            <Link className="button secondary" href="/projects/new">
              Start a project
            </Link>
          )}
        </div>
      </div>
      {next.length > 0 && (
        <>
          <h3>For you</h3>
          <ul>
            {next.map((item) => (
              <li key={item.id}>
                <Link className="text-link" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
