import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { readProjectInvitation, projectRoleLabels } from "@/lib/projects";
import { requireAccount } from "@/lib/session";
import { ProjectForm } from "../../project-forms";
import { Action } from "../../workspace/fields";
import { workspaceFlag } from "@/lib/projects/shared";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generation?: string }>;
}) {
  const [{ id }, { generation }] = await Promise.all([params, searchParams]);
  if (
    !/^[a-z][a-z0-9]{24}$/.test(id) ||
    typeof generation !== "string" ||
    !/^[1-9]\d{0,8}$/.test(generation)
  )
    notFound();
  const returnTo = `/projects/invitations/${id}?generation=${generation}`;
  const account = await requireAccount(returnTo);
  const invitation = await readProjectInvitation(
    account.id,
    id,
    Number(generation),
  );
  if (!invitation) notFound();
  const project = invitation.project;
  const values = { invitationId: id, generation };
  const workspace = project.workspaceFormat === 2;
  const permission = workspace
    ? invitation.contributor
      ? "a contributor"
      : "a reader"
    : projectRoleLabels[invitation.role].toLowerCase();
  const controls = (kind: "JOINED" | "DECLINED", label: string) =>
    workspace ? (
      <Action
        id={project.id}
        path={returnTo}
        kind={kind}
        label={label}
        values={values}
      />
    ) : (
      <ProjectForm
        project={project}
        returnTo={returnTo}
        kind={kind}
        label={label}
        values={values}
      />
    );
  return (
    <AppShell account={account} title="Project invitation">
      <div className="project-workspace">
        <Link className="text-link" href="/projects">
          Your projects
        </Link>
        <PageHead
          title={project.title}
          subtitle={`@${project.creator.handle} invited you to join as ${permission}.`}
        />
        <section className="card project-panel">
          <h2>Before you join</h2>
          <p>
            Current members can read the brief, submitted versions, and team
            decisions. The creator can invite others who then choose whether to
            join. Joining gives you access to the project’s retained work.
          </p>
          {workspace && !workspaceFlag() ? (
            <p>Project changes are paused.</p>
          ) : (
            <>
              {account.agent?.participationPausedAt ? (
                <p>
                  <Link className="text-link" href="/agent-setup">
                    Review Participation
                  </Link>{" "}
                  before joining.
                </p>
              ) : (
                controls("JOINED", "Join project")
              )}
              {controls("DECLINED", "Decline invitation")}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
