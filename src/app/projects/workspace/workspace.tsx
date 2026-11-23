import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  workspaceTaskPath,
  readWorkspace,
  staffing,
  workspaceQueue,
  type WorkspaceView,
  type WorkItem,
} from "@/lib/projects/queries";
import { workspaceFlag } from "@/lib/projects/shared";
import type { CurrentAccount } from "@/lib/session";
import { Action, author, Field } from "./fields";
import { Plan, Team } from "./plan";
import { Deliveries, Outputs, Package } from "./delivery";
import { Discussion, TaskPage } from "./work";

const tabs = [
  ["Overview", ""],
  ["Plan", "/plan"],
  ["Outputs", "/outputs"],
  ["Decisions", "/decisions"],
  ["Delivery", "/delivery"],
  ["Team", "/team"],
] as const;
const verbs: Record<string, string> = {
  BRIEF_EDITED: "edited the brief",
  TASK_ADDED: "added a task",
  TASK_EDITED: "edited a task",
  TASK_MOVED: "reordered the plan",
  MILESTONE_SAVED: "updated a milestone",
  DEPENDENCY_SAVED: "changed a required input",
  PROPOSED: "proposed a plan change",
  PROPOSAL_RESOLVED: "resolved a proposal",
  ASSIGNED: "updated an assignment",
  TAKEN: "started work",
  REOPENED: "reopened a task",
  SUBMITTED: "submitted a version",
  RECOMMENDED: "recommended a version",
  CHANGES_REQUESTED: "requested changes",
  TASK_APPROVED: "approved a version",
  INPUT_RESOLVED: "resolved a newer input",
  NOTE_ADDED: "shared context",
  COMMENTED: "commented",
  QUESTION_ASKED: "asked a question",
  QUESTION_ANSWERED: "answered a question",
  QUESTION_REASSIGNED: "reassigned a question",
  RELEASE_PREPARED: "prepared a package",
  RELEASE_APPROVED: "approved a package",
  RELEASE_RETURNED: "returned a package for changes",
  INVITED: "sent an invitation",
  JOINED: "joined",
  DECLINED: "declined an invitation",
  LEFT: "left the project",
  REMOVED: "removed access",
  CLOSED: "closed the project",
  APPROVED: "approved a version",
};

export function WorkItems({
  items,
  empty,
}: {
  items: WorkItem[];
  empty?: string;
}) {
  return items.length ? (
    <ul className="workspace-list">
      {items.map((item) => (
        <li key={item.id} className="workspace-item">
          <Link className="text-link workspace-item-title" href={item.href}>
            {item.label}
          </Link>
          <p className="muted">
            {item.project}
            {item.status && ` · ${item.status}`}
          </p>
        </li>
      ))}
    </ul>
  ) : empty ? (
    <p>{empty}</p>
  ) : null;
}

async function Overview({
  view,
  path,
  manage,
  before,
}: {
  view: WorkspaceView;
  path: string;
  manage: boolean;
  before?: string;
}) {
  const { project, tasks } = view;
  const base = `/projects/${project.id}`;
  const queue = await workspaceQueue(view.actor.accountId, { limit: 20 });
  const personal = [...queue.decisions, ...queue.work].find((entry) =>
    entry.href.startsWith(base + "/"),
  );
  const since = before
    ? view.activity
    : view.activity.filter(
        (event) => !view.visit || event.id > view.visit.seenThrough,
      );
  const waiting = tasks
    .filter((task) =>
      /^(Waiting|Assigned|Unassigned|New input|Needs)/.test(
        staffing(project, task),
      ),
    )
    .slice(0, 6);
  const milestone = view.milestones.find((item) =>
    tasks.some(
      (task) => task.milestoneId === item.id && task.status !== "COMPLETE",
    ),
  );
  const delivery = view.releases.find((release) => release.approvedAt);
  return (
    <div className="workspace-stack">
      <section className="workspace-feature">
        <div>
          <h2>
            {personal
              ? "Your next action"
              : tasks.length
                ? "Project outcome"
                : "Make a plan"}
          </h2>
          <p className="project-copy">
            {personal
              ? (personal.status ?? "Ready for your input")
              : tasks.length
                ? project.brief
                : "Turn the outcome into tasks you and your teammates can take on."}
          </p>
        </div>
        {personal && (
          <Link className="button" href={personal.href}>
            {personal.label}
          </Link>
        )}
        {!personal && !tasks.length && (
          <Link className="button" href={`${base}/plan`}>
            Open the plan
          </Link>
        )}
      </section>
      <div className="workspace-split">
        <section className="workspace-panel">
          <h2>Brief</h2>
          <p className="project-copy">{project.brief}</p>
          <h3>What counts as done</h3>
          <p className="project-copy">{project.doneWhen}</p>
          {manage && (
            <details>
              <summary>Edit brief</summary>
              <Action
                id={project.id}
                path={path}
                kind="BRIEF_EDITED"
                label="Save brief"
                values={{ revision: project.planRevision }}
              >
                <Field
                  label="Project name"
                  name="title"
                  value={project.title}
                  maxLength={80}
                />
                <Field
                  label="Project outcome"
                  name="brief"
                  value={project.brief}
                  rows={3}
                />
                <Field
                  label="Success criteria"
                  name="doneWhen"
                  value={project.doneWhen}
                  rows={2}
                  maxLength={1500}
                />
                <Field
                  label="Due date (optional)"
                  name="dueOn"
                  type="date"
                  value={project.dueOn}
                  required={false}
                />
              </Action>
            </details>
          )}
          {view.briefs.length > 1 && (
            <details>
              <summary>Earlier briefs</summary>
              {view.briefs.slice(1).map((brief) => (
                <article key={brief.number}>
                  <h3>{brief.createdAt.toDateString()}</h3>
                  <p>{brief.brief}</p>
                  <p>{brief.doneWhen}</p>
                </article>
              ))}
            </details>
          )}
        </section>
        <section className="workspace-panel">
          <h2>Work at a glance</h2>
          {milestone && (
            <p>
              Next milestone · {milestone.title}
              {milestone.dueOn && ` · ${milestone.dueOn}`}
            </p>
          )}
          <p>
            {tasks.filter((task) => task.status === "COMPLETE").length} of{" "}
            {tasks.length} tasks completed ·{" "}
            {
              project.memberships.filter((entry) => entry.status === "ACCEPTED")
                .length
            }{" "}
            joined
          </p>
          {waiting.length > 0 && (
            <ul className="workspace-list">
              {waiting.map((task) => (
                <li className="workspace-item" key={task.id}>
                  <Link
                    className="text-link"
                    href={workspaceTaskPath(project.id, task.id)}
                  >
                    {task.title}
                  </Link>
                  <p>{staffing(project, task)}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="workspace-inline">
            <Link className="text-link" href={`${base}/team`}>
              View team
            </Link>
            {delivery && (
              <Link
                className="text-link"
                href={`${base}/delivery/${delivery.id}`}
              >
                Open approved delivery
              </Link>
            )}
          </div>
          {!delivery && tasks.some((task) => task.status === "COMPLETE") && (
            <Link className="text-link" href={`${base}/outputs`}>
              See {tasks.filter((task) => task.status === "COMPLETE").length}{" "}
              ready outputs
            </Link>
          )}
        </section>
      </div>
      <section className="workspace-panel">
        <h2>{before ? "Earlier activity" : "Since your last visit"}</h2>
        {!since.length && <p>No new project activity.</p>}
        <ul className="workspace-list">
          {since.map((event) => {
            const link = event.releaseId
              ? `${base}/delivery/${event.releaseId}`
              : event.postId
                ? `${base}/questions/${event.postId}`
                : event.taskId
                  ? workspaceTaskPath(
                      project.id,
                      event.taskId,
                      event.version ?? undefined,
                    )
                  : null;
            const title = event.taskId
              ? view.tasks.find((task) => task.id === event.taskId)?.title
              : null;
            const label = `${author(view, event.actorId)} ${verbs[event.kind] ?? "updated the workspace"}${title ? ` · ${title}` : ""}`;
            return (
              <li className="workspace-item" key={event.id}>
                {link ? (
                  <Link className="text-link" href={link}>
                    {label}
                  </Link>
                ) : (
                  label
                )}
                {event.note && <p className="project-copy">{event.note}</p>}
                <time
                  className="muted"
                  dateTime={event.createdAt.toISOString()}
                >
                  {event.createdAt.toLocaleDateString("en-US", {
                    timeZone: "UTC",
                  })}
                </time>
              </li>
            );
          })}
        </ul>
        <div className="workspace-inline">
          {!before && since[0] && (
            <Action
              id={project.id}
              path={base}
              kind="VISITED"
              label="Mark activity seen"
              values={{ seenThrough: since[0].id }}
            />
          )}
          {view.activityNext && (
            <Link
              className="text-link"
              href={`${base}?before=${view.activityNext}`}
            >
              Earlier activity
            </Link>
          )}
          {before && (
            <Link className="text-link" href={base}>
              Latest activity
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

export async function WorkspacePage({
  account,
  id,
  path,
  work,
  query,
}: {
  account: CurrentAccount;
  id: string;
  path: string;
  work: string[];
  query: Record<string, string | undefined>;
}) {
  const section = work[0] ?? "overview";
  const view = await readWorkspace(account.id, id, {
    taskId: section === "tasks" ? work[1] : undefined,
    version: work[2] === "versions" ? Number(work[3]) : undefined,
    releaseId: section === "delivery" ? work[1] : undefined,
    postId: section === "questions" ? work[1] : undefined,
    before: query.before,
  });
  if (
    !view ||
    (section === "tasks" && (!view.task || (work[3] && !view.current))) ||
    (section === "delivery" && work[1] && !view.release) ||
    (section === "questions" && !view.post)
  )
    notFound();
  const lead = view.project.creatorAccountId === account.id;
  const enabled = workspaceFlag();
  const writable = enabled && !view.project.closedAt;
  const manage = writable && lead;
  const contribute =
    writable && view.actor.contributor && !account.agent?.participationPausedAt;
  const base = `/projects/${id}`;
  const active = ["tasks"].includes(section)
    ? "plan"
    : section === "questions"
      ? "decisions"
      : section;
  const title =
    view.release?.title ??
    view.task?.title ??
    (view.post ? "Project question" : view.project.title);
  return (
    <AppShell account={account} active="projects" title={title}>
      <div className="workspace-v2">
        <header className="workspace-heading workspace-print-hide">
          <Link
            className="text-link"
            href={section === "overview" ? "/projects" : base}
          >
            {section === "overview" ? "Projects" : view.project.title}
          </Link>
          <h1>{title}</h1>
          <p>
            {author(view, view.project.creatorAccountId)} leads this project
            {view.project.dueOn && ` · Due ${view.project.dueOn}`}
            {view.project.closedAt && " · Closed"}
          </p>
        </header>
        <nav
          className="workspace-tabs workspace-print-hide"
          aria-label="Project navigation"
        >
          {tabs.map(([label, suffix]) => (
            <Link
              key={label}
              aria-current={active === label.toLowerCase() ? "page" : undefined}
              href={base + suffix}
            >
              {label}
            </Link>
          ))}
        </nav>
        {!enabled && (
          <p className="workspace-answer">
            Project changes are paused. Saved work remains available.
          </p>
        )}
        {!!account.agent?.participationPausedAt && (
          <p className="workspace-answer">
            Agent participation is paused.{" "}
            <Link className="text-link" href="/agent-setup">
              Review Participation
            </Link>
          </p>
        )}
        {section === "overview" && (
          <Overview
            view={view}
            path={path}
            manage={manage}
            before={query.before}
          />
        )}
        {section === "plan" && (
          <Plan
            view={view}
            path={path}
            filter={query.view}
            manage={manage}
            contribute={contribute}
          />
        )}
        {section === "team" && (
          <Team
            view={view}
            path={path}
            search={query.q}
            manage={manage}
            writable={enabled && (!lead || writable)}
          />
        )}
        {section === "outputs" && (
          <Outputs view={view} path={path} contribute={contribute} />
        )}
        {section === "tasks" && (
          <TaskPage
            view={view}
            path={path}
            manage={manage}
            contribute={contribute}
          />
        )}
        {section === "decisions" && (
          <Discussion
            view={view}
            path={path}
            items={view.projectQuestions}
            manage={manage}
            contribute={contribute}
          />
        )}
        {section === "questions" && view.post && (
          <Discussion
            view={view}
            path={path}
            items={[view.post]}
            manage={manage}
            contribute={contribute}
            focused
          />
        )}
        {section === "delivery" &&
          (view.release ? (
            <Package view={view} path={path} contribute={contribute} />
          ) : (
            <Deliveries view={view} path={path} manage={manage} />
          ))}
      </div>
    </AppShell>
  );
}
