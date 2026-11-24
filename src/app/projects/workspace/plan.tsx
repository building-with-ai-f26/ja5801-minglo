import Link from "next/link";
import Form from "next/form";
import { searchAccounts } from "@/lib/discovery";
import {
  staffing,
  type WorkspaceTaskView,
  type WorkspaceView,
} from "@/lib/projects/queries";
import {
  Action,
  author,
  Field,
  MemberSelect,
  ReadinessSelect,
  readinessLabels,
} from "./fields";

export function Assign({
  view,
  task,
  path,
}: {
  view: WorkspaceView;
  task: WorkspaceTaskView;
  path: string;
}) {
  return (
    <Action
      id={view.project.id}
      path={path}
      kind="ASSIGNED"
      label="Save assignment"
      values={{ taskId: task.id, revision: task.revision }}
    >
      <MemberSelect
        view={view}
        name="ownerId"
        label="Owner"
        selfLabel
        value={task.ownerId}
        pending
      />
      <ReadinessSelect value={task.readiness} />
      <p className="muted">
        Invited contributors can be assigned. They can act after joining.
      </p>
      <MemberSelect
        view={view}
        name="reviewerId"
        label="Reviewer"
        value={task.reviewerId}
        pending
      />
      <MemberSelect
        view={view}
        name="approverId"
        label="Human approver"
        value={task.approverId}
        pending
        human
      />
    </Action>
  );
}

export function TaskFields({
  view,
  task,
}: {
  view: WorkspaceView;
  task?: WorkspaceTaskView;
}) {
  return (
    <>
      <Field
        label="Task title"
        name="title"
        value={task?.title}
        maxLength={100}
      />
      <Field label="Task brief" name="brief" value={task?.brief} rows={3} />
      <Field
        label="Done when"
        name="doneWhen"
        value={task?.doneWhen}
        rows={2}
        maxLength={1500}
      />
      <Field
        label="Output name"
        name="output"
        value={task?.output?.title}
        maxLength={120}
      />
      <div className="workspace-split">
        <Field
          label="Due date (optional)"
          name="dueOn"
          value={task?.dueOn}
          type="date"
          required={false}
        />
        <label className="field">
          <span>Milestone</span>
          <select name="milestoneId" defaultValue={task?.milestoneId ?? ""}>
            <option value="">No milestone</option>
            {view.milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="workspace-check">
        <input
          type="checkbox"
          name="required"
          value="true"
          defaultChecked={task?.required ?? true}
        />{" "}
        Required for delivery
      </label>
    </>
  );
}

export function Plan({
  view,
  path,
  filter,
  manage,
  contribute,
}: {
  view: WorkspaceView;
  path: string;
  filter?: string;
  manage: boolean;
  contribute: boolean;
}) {
  const { project } = view;
  const base = `/projects/${project.id}/plan`;
  const tasks = view.tasks.filter((task) => {
    const status = staffing(project, task);
    if (filter === "mine")
      return [task.ownerId, task.reviewerId, task.approverId].includes(
        view.actor.accountId,
      );
    if (filter === "ready") return status === "Ready";
    if (filter === "waiting")
      return /^(Waiting|Assigned agent paused|Unassigned|New input available)/.test(
        status,
      );
    if (filter === "completed") return task.status === "COMPLETE";
    return true;
  });
  return (
    <div className="workspace-stack">
      <nav className="workspace-filters" aria-label="Task filters">
        {[
          ["", "All"],
          ["mine", "Mine"],
          ["ready", "Ready"],
          ["waiting", "Waiting"],
          ["completed", "Done"],
        ].map(([value, label]) => (
          <Link
            key={label}
            aria-current={(filter ?? "") === value ? "page" : undefined}
            href={value ? `${base}?view=${value}` : base}
          >
            {label}
          </Link>
        ))}
      </nav>
      {manage && (
        <div className="workspace-toolbar workspace-plan-tools">
          <details id="add-task" open={!view.tasks.length}>
            <summary>Add a task</summary>
            <Action
              id={project.id}
              path={path}
              kind="TASK_ADDED"
              label="Add task"
              values={{ revision: project.planRevision }}
            >
              <TaskFields view={view} />
            </Action>
          </details>
          <details>
            <summary>Add a milestone</summary>
            <Action
              id={project.id}
              path={path}
              kind="MILESTONE_SAVED"
              label="Add milestone"
              values={{ revision: project.planRevision }}
            >
              <Field label="Milestone name" name="title" maxLength={100} />
              <Field
                label="Due date (optional)"
                name="dueOn"
                type="date"
                required={false}
              />
            </Action>
          </details>
        </div>
      )}
      {!tasks.length && (
        <p>
          {view.tasks.length
            ? "No tasks match this filter."
            : "Start by giving the team its first task."}
        </p>
      )}
      {[
        ...view.milestones,
        {
          id: null,
          title: view.milestones.length ? "Without a milestone" : "Task list",
          dueOn: null,
        },
      ].map((milestone) => {
        const group = tasks.filter((task) => task.milestoneId === milestone.id);
        if (!group.length && (!milestone.id || filter)) return null;
        return (
          <section className="workspace-panel" key={milestone.id ?? "none"}>
            <div className="workspace-row">
              <h2>{milestone.title}</h2>
              {milestone.dueOn && (
                <time dateTime={milestone.dueOn}>{milestone.dueOn}</time>
              )}
            </div>
            {group.length === 0 && <p>No tasks in this milestone.</p>}
            <ul className="workspace-list">
              {group.map((task, index) => (
                <li
                  key={task.id}
                  className="workspace-item workspace-plan-task"
                >
                  <div className="workspace-row workspace-task-row">
                    <div>
                      <Link
                        className="text-link workspace-item-title"
                        href={`/projects/${project.id}/tasks/${task.id}`}
                      >
                        {task.title}
                      </Link>
                      <p className="muted">
                        {task.ownerId && `${author(view, task.ownerId)} · `}
                        Complete when{" "}
                        {readinessLabels[task.readiness].toLowerCase()}
                        {task.dueOn ? ` · Due ${task.dueOn}` : ""}
                      </p>
                    </div>
                    <span className="workspace-status">
                      {staffing(project, task)}
                    </span>
                  </div>
                  {manage && (
                    <div className="workspace-task-tools">
                      {task.status !== "COMPLETE" && (
                        <details>
                          <summary>
                            {task.ownerId ? "Change assignment" : "Assign task"}
                          </summary>
                          <Assign view={view} task={task} path={path} />
                        </details>
                      )}
                      {!filter && group.length > 1 && (
                        <details className="workspace-reorder">
                          <summary aria-label={`Reorder ${task.title}`}>
                            Reorder
                          </summary>
                          <div className="workspace-inline">
                            {index > 0 && (
                              <Action
                                id={project.id}
                                path={path}
                                kind="TASK_MOVED"
                                label="Move up"
                                secondary
                                values={{
                                  taskId: task.id,
                                  revision: project.planRevision,
                                  direction: "up",
                                }}
                              />
                            )}
                            {index < group.length - 1 && (
                              <Action
                                id={project.id}
                                path={path}
                                kind="TASK_MOVED"
                                label="Move down"
                                secondary
                                values={{
                                  taskId: task.id,
                                  revision: project.planRevision,
                                  direction: "down",
                                }}
                              />
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {manage && milestone.id && (
              <details>
                <summary>Edit milestone</summary>
                <Action
                  id={project.id}
                  path={path}
                  kind="MILESTONE_SAVED"
                  label="Save milestone"
                  values={{
                    revision: project.planRevision,
                    milestoneId: milestone.id,
                  }}
                >
                  <Field
                    label="Milestone name"
                    name="title"
                    value={milestone.title}
                    maxLength={100}
                  />
                  <Field
                    label="Due date (optional)"
                    name="dueOn"
                    value={milestone.dueOn}
                    type="date"
                    required={false}
                  />
                </Action>
              </details>
            )}
          </section>
        );
      })}
      {contribute && (
        <details className="workspace-panel">
          <summary>Propose a plan change</summary>
          <Action
            id={project.id}
            path={path}
            kind="PROPOSED"
            label="Send proposal"
            values={{ revision: project.planRevision }}
          >
            <label className="field">
              <span>Proposal type</span>
              <select name="scope">
                <option value="TASK">New task</option>
                <option value="BRIEF">Revised project brief</option>
              </select>
            </label>
            <Field label="Proposal title" name="title" maxLength={100} />
            <Field label="Proposed change" name="brief" rows={3} />
            <Field
              label="Done when"
              name="doneWhen"
              rows={2}
              maxLength={1500}
            />
          </Action>
        </details>
      )}
      {view.proposals.length > 0 && (
        <section className="workspace-panel">
          <h2>Proposals</h2>
          <ul className="workspace-list">
            {view.proposals.map((proposal) => (
              <li key={proposal.id} className="workspace-item">
                <h3>{proposal.title}</h3>
                <p className="muted">
                  {author(view, proposal.authorId)} ·{" "}
                  {proposal.scope === "TASK" ? "New task" : "Revised brief"}
                </p>
                <p className="project-copy">{proposal.brief}</p>
                <p>{proposal.doneWhen}</p>
                {manage && (
                  <div className="workspace-stack">
                    <details>
                      <summary>Review proposal</summary>
                      <Action
                        id={project.id}
                        path={path}
                        kind="PROPOSAL_RESOLVED"
                        label="Adopt proposal"
                        values={{
                          proposalId: proposal.id,
                          revision: project.planRevision,
                          accept: "true",
                        }}
                      >
                        {proposal.baseRevision !== project.planRevision && (
                          <p>
                            The plan has changed since this proposal was made.
                            Review it against current work.
                          </p>
                        )}
                        <Field
                          label="Title"
                          name="title"
                          value={proposal.title}
                          maxLength={100}
                        />
                        <Field
                          label="Change"
                          name="brief"
                          value={proposal.brief}
                          rows={3}
                        />
                        <Field
                          label="Done when"
                          name="doneWhen"
                          value={proposal.doneWhen}
                          rows={2}
                          maxLength={1500}
                        />
                      </Action>
                    </details>
                    <Action
                      id={project.id}
                      path={path}
                      kind="PROPOSAL_RESOLVED"
                      label="Decline proposal"
                      values={{
                        proposalId: proposal.id,
                        revision: project.planRevision,
                        title: proposal.title,
                        brief: proposal.brief,
                        doneWhen: proposal.doneWhen,
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export async function Team({
  view,
  path,
  search,
  manage,
  writable,
}: {
  view: WorkspaceView;
  path: string;
  search?: string;
  manage: boolean;
  writable: boolean;
}) {
  const { project } = view;
  const results =
    manage && search
      ? (await searchAccounts(view.actor.accountId, { q: search })).accounts
      : [];
  const { db } = await import("@/lib/db");
  const owned = manage
    ? await db.agent.findMany({
        where: { owner: { accountId: view.actor.accountId } },
        select: {
          displayName: true,
          account: { select: { id: true, handle: true } },
        },
        take: 24,
      })
    : [];
  const candidates = search
    ? results
    : owned.map((entry) => ({
        ...entry.account,
        displayName: entry.displayName,
        type: "AGENT",
      }));
  const invitePath = `/projects/${project.id}/team`;
  const inviteForm = (
    <section className="workspace-panel" id="invite-teammates">
      <h2>Invite teammates</h2>
      <Form action={invitePath} className="workspace-inline">
        <Field
          label="Search by name or handle"
          name="q"
          value={search}
          maxLength={60}
        />
        <button className="button" type="submit">
          Search
        </button>
      </Form>
      {candidates.length ? (
        <ul className="workspace-list">
          {candidates
            .filter(
              (candidate) =>
                !project.memberships.some(
                  (member) => member.accountId === candidate.id,
                ),
            )
            .map((candidate) => (
              <li key={candidate.id} className="workspace-item">
                <p>
                  <strong>{candidate.displayName}</strong> · @{candidate.handle}{" "}
                  · {candidate.type === "AGENT" ? "Agent" : "Person"}
                </p>
                <Action
                  id={project.id}
                  path={path}
                  kind="INVITED"
                  label={`Invite @${candidate.handle}`}
                  values={{ handle: candidate.handle }}
                >
                  <label className="field">
                    <span>Invite as</span>
                    <select name="contributor" defaultValue="true">
                      <option value="true">Contributor</option>
                      <option value="false">Reader</option>
                    </select>
                  </label>
                </Action>
              </li>
            ))}
        </ul>
      ) : search ? (
        <p>No accounts match your search.</p>
      ) : null}
      <details>
        <summary>Invite by exact handle</summary>
        <Action
          id={project.id}
          path={path}
          kind="INVITED"
          label="Send invitation"
        >
          <Field label="Handle" name="handle" maxLength={30} />
          <label className="field">
            <span>Invite as</span>
            <select name="contributor" defaultValue="true">
              <option value="true">Contributor</option>
              <option value="false">Reader</option>
            </select>
          </label>
        </Action>
      </details>
    </section>
  );
  return (
    <div className="workspace-stack">
      {manage && (
        <Link
          className="workspace-team-invite text-link"
          href="#invite-teammates"
        >
          Invite teammates
        </Link>
      )}
      {manage && search && inviteForm}
      {(["ACCEPTED", "INVITED"] as const).map((status) => (
        <section className="workspace-panel" key={status}>
          <h2>
            {status === "ACCEPTED" ? "Joined members" : "Pending invitations"}
          </h2>
          <ul className="workspace-list">
            {project.memberships
              .filter((member) => member.status === status)
              .map((member) => (
                <li key={member.id} className="workspace-row workspace-item">
                  <span>
                    <strong>@{member.account.handle}</strong> ·{" "}
                    {member.account.type === "AGENT" ? "Agent" : "Person"} ·{" "}
                    {member.accountId === project.creatorAccountId
                      ? "Lead"
                      : member.contributor
                        ? "Contributor"
                        : "Reader"}
                    {member.account.agent?.participationPausedAt &&
                      status === "ACCEPTED" &&
                      " · Participation paused"}
                  </span>
                  {manage && member.accountId !== project.creatorAccountId && (
                    <Action
                      id={project.id}
                      path={path}
                      kind="REMOVED"
                      secondary
                      label={
                        status === "INVITED"
                          ? "Cancel invitation"
                          : `Remove @${member.account.handle}`
                      }
                      values={{ memberId: member.id }}
                    />
                  )}
                </li>
              ))}
          </ul>
          {!project.memberships.some((member) => member.status === status) && (
            <p>No pending invitations.</p>
          )}
        </section>
      ))}
      {manage && !search && inviteForm}
      {writable && (
        <details className="workspace-panel">
          <summary>{manage ? "Close project" : "Leave project"}</summary>
          <p>
            {manage
              ? "Closing ends pending work and invitations. Members can still open approved deliveries."
              : "Leaving ends your access to project work and deliveries."}
          </p>
          <Action
            id={project.id}
            path={path}
            kind={manage ? "CLOSED" : "LEFT"}
            label={manage ? "Confirm close project" : "Confirm leave project"}
          />
        </details>
      )}
    </div>
  );
}
