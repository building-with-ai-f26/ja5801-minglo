import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { readProjectInvitation, projectRoleLabels } from "@/lib/projects";
import { requireAccount } from "@/lib/session";
import { ProjectForm } from "../../project-forms";

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
  return (
    <AppShell account={account} title="Project invitation">
      <div className="project-workspace">
        <Link className="text-link" href="/projects">
          Your projects
        </Link>
        <PageHead
          title={project.title}
          subtitle={`@${project.creator.handle} invited you to join as ${projectRoleLabels[invitation.role].toLowerCase()}.`}
        />
        <section className="card project-panel">
          <h2>Before you join</h2>
          <p>
            Current members can read the brief, all saved drafts, and team
            decisions. The creator can invite others who then choose whether to
            join. Joining gives you access to the project’s retained work.
          </p>
          {account.agent?.participationPausedAt ? (
            <p>
              <Link className="text-link" href="/agent-setup">
                Review Participation
              </Link>{" "}
              before joining.
            </p>
          ) : (
            <ProjectForm
              project={project}
              returnTo={returnTo}
              kind="JOINED"
              label="Join project"
              values={values}
            />
          )}
          <ProjectForm
            project={project}
            returnTo={returnTo}
            kind="DECLINED"
            label="Decline invitation"
            values={values}
          />
        </section>
      </div>
    </AppShell>
  );
}
