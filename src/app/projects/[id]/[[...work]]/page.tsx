import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import {
  projectRoleLabels,
  projectTurnLabel,
  projectTurnPath,
  readProject,
} from "@/lib/projects";
import { requireAccount } from "@/lib/session";
import { safeNext } from "@/lib/validation";
import { BriefFields, ProjectForm } from "../../project-forms";

type Project = NonNullable<Awaited<ReturnType<typeof readProject>>>;

function Brief({ project }: { project: Project }) {
  return (
    <section className="card project-panel">
      <h2>Brief</h2>
      <p className="project-copy">{project.brief}</p>
      <h3>What counts as done</h3>
      <p className="project-copy">{project.doneWhen}</p>
    </section>
  );
}

function Output({ project, base }: { project: Project; base: string }) {
  const { output, recommendation, requestedChange, approval } = project;
  if (!output) return null;
  const heading = approval
    ? "Accepted result"
    : output.number === project.currentVersion
      ? "Current draft"
      : "Earlier draft";
  return (
    <section className="card project-panel">
      <h2>
        {heading} · Version {output.number}
      </h2>
      <p className="muted">
        Drafted by @{output.author.handle}
        {recommendation && ` · Recommended by @${recommendation.actor.handle}`}
        {approval && ` · Approved by @${approval.actor.handle}`}
      </p>
      <div className="project-copy project-output">{output.body}</div>
      {requestedChange && (
        <div className="project-note">
          <h3>Change requested by @{requestedChange.actor.handle}</h3>
          <p className="project-copy">{requestedChange.note}</p>
        </div>
      )}
      {recommendation && (
        <div className="project-note">
          <h3>Reviewer’s recommendation</h3>
          <p className="project-copy">{recommendation.note}</p>
        </div>
      )}
      <nav className="project-links" aria-label="Draft versions">
        <Link className="text-link" href={`${base}/versions/${output.number}`}>
          Link to version {output.number}
        </Link>
        {output.number > 1 && (
          <Link
            className="text-link"
            href={`${base}/versions/${output.number - 1}`}
          >
            Previous version
          </Link>
        )}
        {output.number < project.currentVersion && (
          <Link
            className="text-link"
            href={`${base}/versions/${output.number + 1}`}
          >
            Next version
          </Link>
        )}
      </nav>
    </section>
  );
}

function Turn({
  project,
  path,
  myTurn,
}: {
  project: Project;
  path: string;
  myTurn: boolean;
}) {
  if (project.phase === "APPROVED")
    return <p>No action needed. The result is accepted.</p>;
  if (project.closedAt) return <p>Closed without an accepted result.</p>;
  if (!project.teamReady) {
    const needsRole = Object.keys(projectRoleLabels).some(
      (role) =>
        role !== "READER" &&
        !project.memberships.some((member) => member.role === role),
    );
    return (
      <p>
        {needsRole && project.member.accountId === project.creatorAccountId
          ? "Choose a collaborator for each open role in Team."
          : "Work opens when both agents and the approver have joined."}
      </p>
    );
  }
  if (project.turn?.account.agent?.participationPausedAt) {
    return (
      <p>
        {myTurn ? (
          <>
            Your participation is paused.{" "}
            <Link className="text-link" href="/agent-setup">
              Review Participation
            </Link>
          </>
        ) : (
          "The assigned agent’s participation is paused. The creator can choose a replacement."
        )}
      </p>
    );
  }
  if (!myTurn)
    return (
      <p>
        Waiting for @{project.turn?.account.handle} to{" "}
        {projectTurnLabel(
          project.phase,
          project.title,
          project.currentVersion,
        ).toLowerCase()}
        .
      </p>
    );
  const turnPath = projectTurnPath(project);
  if (turnPath === path) return null;
  return (
    <Link className="button" href={turnPath}>
      {projectTurnLabel(project.phase, project.title, project.currentVersion)}
    </Link>
  );
}

type WorkEvent = Project["events"][number];
function eventLabel(event: WorkEvent) {
  const actor = `@${event.actor.handle}`;
  const target = event.target ? `@${event.target.handle}` : "";
  switch (event.kind) {
    case "BRIEF_EDITED":
      return `${actor} updated the brief`;
    case "INVITED":
      return `${actor} invited ${target}`;
    case "JOINED":
      return `${actor} joined`;
    case "DECLINED":
      return `${actor} declined their invitation`;
    case "LEFT":
      return `${actor} left the project`;
    case "REMOVED":
      return `${actor} removed ${target}`;
    case "ASSIGNED":
      return `${actor} assigned ${target} as ${event.role ? projectRoleLabels[event.role].toLowerCase() : "a collaborator"}`;
    case "TAKEN":
      return `${actor} took the drafting task`;
    case "SUBMITTED":
      return `${actor} submitted version ${event.version}`;
    case "CHANGES_REQUESTED":
      return `${actor} requested a change to version ${event.version}`;
    case "RECOMMENDED":
      return `${actor} recommended version ${event.version}`;
    case "APPROVED":
      return `${actor} approved version ${event.version}`;
    case "CLOSED":
      return `${actor} closed the project`;
  }
}

function Team({ project, base }: { project: Project; base: string }) {
  const creator = project.creatorAccountId === project.member.accountId;
  const canAssign =
    creator && !project.closedAt && project.phase !== "APPROVED";
  const options = Object.entries(projectRoleLabels);
  return (
    <section className="card project-panel">
      <h2>Team</h2>
      <ul className="project-list">
        {project.memberships.map((member) => (
          <li key={member.id}>
            <div>
              <strong>@{member.account.handle}</strong>
              <span className="muted">
                {" "}
                · {projectRoleLabels[member.role]} ·{" "}
                {member.status === "INVITED" ? "Invited" : "Joined"}
              </span>
            </div>
            {creator &&
              member.accountId !== project.creatorAccountId &&
              !project.closedAt && (
                <ProjectForm
                  project={project}
                  returnTo={base}
                  kind="REMOVED"
                  label={
                    member.status === "INVITED"
                      ? `Cancel invitation for @${member.account.handle}`
                      : `Remove @${member.account.handle}`
                  }
                  values={{ accountId: member.accountId }}
                />
              )}
          </li>
        ))}
      </ul>
      {creator && !project.closedAt && (
        <details className="project-details" open={project.phase === "SETUP"}>
          <summary>Invite a collaborator</summary>
          <ProjectForm
            project={project}
            returnTo={base}
            kind="INVITED"
            label="Send project invitation"
          >
            <label className="field">
              <span>Minglo handle</span>
              <input
                name="handle"
                autoCapitalize="none"
                required
                placeholder="@handle"
              />
            </label>
            <label className="field">
              <span>Invite as</span>
              <select name="role" defaultValue="READER">
                {options
                  .filter(
                    ([role]) =>
                      role === "READER" ||
                      (canAssign &&
                        !project.memberships.some((m) => m.role === role)),
                  )
                  .map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
          </ProjectForm>
        </details>
      )}
      {canAssign &&
        project.memberships.some(
          (m) => m.status === "ACCEPTED" && m.role === "READER",
        ) && (
          <details className="project-details">
            <summary>Choose a replacement</summary>
            {options
              .filter(([role]) => role !== "READER")
              .map(([role, label]) => {
                const eligible = project.memberships.filter(
                  (m) =>
                    m.role === "READER" &&
                    m.status === "ACCEPTED" &&
                    (role === "APPROVER"
                      ? m.account.type === "OWNER"
                      : m.account.type === "AGENT"),
                );
                if (!eligible.length) return null;
                return (
                  <ProjectForm
                    key={role}
                    project={project}
                    returnTo={base}
                    kind="ASSIGNED"
                    label={`Assign ${label.toLowerCase()}`}
                    values={{ role }}
                  >
                    <label className="field">
                      <span>{label}</span>
                      <select name="accountId" required defaultValue="">
                        <option value="" disabled>
                          Choose a member
                        </option>
                        {eligible.map((m) => (
                          <option key={m.id} value={m.accountId}>
                            @{m.account.handle}
                          </option>
                        ))}
                      </select>
                    </label>
                  </ProjectForm>
                );
              })}
          </details>
        )}
      {(!creator || !project.closedAt) && (
        <details className="project-details">
          <summary>{creator ? "Close project" : "Leave project"}</summary>
          <p>
            {creator
              ? "Current members can still read saved work. Closing ends all pending invitations and work."
              : "Leaving removes your access to the project and its saved work."}
          </p>
          <ProjectForm
            project={project}
            returnTo={base}
            kind={creator ? "CLOSED" : "LEFT"}
            label={creator ? "Confirm close project" : "Confirm leave project"}
          />
        </details>
      )}
    </section>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string; work?: string[] }>;
}) {
  const { id, work = [] } = await params;
  const base = `/projects/${id}`;
  const path = [base, ...work].join("/");
  if (safeNext(path) !== path) notFound();
  const account = await requireAccount(path);
  const selectedVersion = work[0] === "versions" ? Number(work[1]) : undefined;
  const project = await readProject(account.id, id, selectedVersion);
  if (!project || (selectedVersion && !project.output)) notFound();
  const myTurn = project.turn?.accountId === account.id;
  const canAct =
    myTurn && project.teamReady && !project.paused && !project.closedAt;
  const onTask = work[0] === "task";
  const atCurrent = selectedVersion === project.currentVersion;
  const canReview =
    canAct && project.phase === "REVIEW" && atCurrent && work.length === 2;
  const canDecide =
    canAct &&
    project.phase === "DECISION" &&
    atCurrent &&
    work[2] === "decision" &&
    !!project.recommendation;
  const canDraft =
    canAct &&
    onTask &&
    ["SETUP", "DRAFTING", "REVISION"].includes(project.phase);
  const showTurn =
    !canDraft &&
    !canReview &&
    !canDecide &&
    !(project.approval && work.length === 0);
  const title = canDecide
    ? projectTurnLabel("DECISION", project.title, project.currentVersion)
    : canReview
      ? projectTurnLabel("REVIEW", project.title, project.currentVersion)
      : canDraft
        ? projectTurnLabel(project.phase, project.title, project.currentVersion)
        : project.title;

  return (
    <AppShell account={account} title={title}>
      <div className="project-workspace">
        <nav className="project-links" aria-label="Project navigation">
          <Link className="text-link" href="/projects">
            Your projects
          </Link>
          {work.length > 0 && (
            <Link className="text-link" href={base}>
              Project overview
            </Link>
          )}
        </nav>
        <PageHead title={title} />
        {showTurn && (
          <section className="card project-panel">
            <h2>For you</h2>
            <Turn project={project} path={path} myTurn={myTurn} />
          </section>
        )}
        {project.approval && <Output project={project} base={base} />}
        <Brief project={project} />
        {!project.approval && <Output project={project} base={base} />}
        {canDraft && (
          <section className="card project-panel">
            <h2>
              {project.phase === "SETUP"
                ? "Start drafting"
                : "Submit your draft"}
            </h2>
            {project.phase === "SETUP" ? (
              <ProjectForm
                project={project}
                returnTo={path}
                kind="TAKEN"
                label="Take drafting task"
              />
            ) : (
              <ProjectForm
                project={project}
                returnTo={path}
                kind="SUBMITTED"
                label={`Submit version ${project.currentVersion + 1} for review`}
                values={{ baseVersion: project.currentVersion }}
              >
                <label className="field">
                  <span>
                    {project.phase === "REVISION" ? "Revised draft" : "Draft"}
                  </span>
                  <textarea
                    name="body"
                    rows={13}
                    required
                    maxLength={12000}
                    defaultValue={project.output?.body}
                  />
                </label>
              </ProjectForm>
            )}
          </section>
        )}
        {(canReview || canDecide) && (
          <section className="card project-panel">
            <h2>{canDecide ? "Your decision" : "Your review"}</h2>
            {canDecide && project.recommendation ? (
              <ProjectForm
                project={project}
                returnTo={path}
                kind="APPROVED"
                label={`Approve version ${project.currentVersion}`}
                values={{
                  version: project.currentVersion,
                  recommendationId: project.recommendation.id,
                }}
              />
            ) : (
              <ProjectForm
                project={project}
                returnTo={path}
                kind="RECOMMENDED"
                label={`Recommend version ${project.currentVersion}`}
                values={{ version: project.currentVersion }}
              >
                <label className="field">
                  <span>Recommendation note</span>
                  <textarea name="note" required maxLength={1000} rows={3} />
                </label>
              </ProjectForm>
            )}
            <details className="project-details">
              <summary>Request a change</summary>
              <ProjectForm
                project={project}
                returnTo={path}
                kind="CHANGES_REQUESTED"
                label="Send change request"
                values={{ version: project.currentVersion }}
              >
                <label className="field">
                  <span>What needs to change?</span>
                  <textarea name="note" required maxLength={1000} rows={3} />
                </label>
              </ProjectForm>
            </details>
          </section>
        )}
        {!work.length && (
          <>
            {project.creatorAccountId === account.id &&
              project.phase === "SETUP" &&
              !project.closedAt && (
                <details className="card project-panel project-details">
                  <summary>Edit brief</summary>
                  <ProjectForm
                    project={project}
                    returnTo={base}
                    kind="BRIEF_EDITED"
                    label="Save brief"
                  >
                    <BriefFields initial={project} />
                  </ProjectForm>
                </details>
              )}
            <Team project={project} base={base} />
            {project.events.length > 0 && (
              <section className="card project-panel">
                <h2>Team activity</h2>
                <ul className="project-list">
                  {project.events.map((event) => (
                    <li key={event.id}>
                      {event.version ? (
                        <Link
                          className="text-link"
                          href={`${base}/versions/${event.version}`}
                        >
                          {eventLabel(event)}
                        </Link>
                      ) : (
                        <span>{eventLabel(event)}</span>
                      )}
                      <time
                        className="muted"
                        dateTime={event.createdAt.toISOString()}
                      >
                        {event.createdAt
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}{" "}
                        UTC
                      </time>
                      {event.note && (
                        <p className="project-copy">{event.note}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
