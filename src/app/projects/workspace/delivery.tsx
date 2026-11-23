import Link from "next/link";
import { packageMarkdown } from "@/lib/projects/export";
import {
  workspaceTaskPath,
  staffing,
  type WorkspaceView,
} from "@/lib/projects/queries";
import { Action, author, Field, MemberSelect, readinessLabels } from "./fields";
import { DeliveryTools } from "./editor";
import { DocumentText } from "./document";

export function Outputs({
  view,
  path,
  contribute,
}: {
  view: WorkspaceView;
  path: string;
  contribute: boolean;
}) {
  const id = view.project.id;
  return (
    <div className="workspace-stack">
      <section className="workspace-panel">
        <h2>Deliverables</h2>
        {view.tasks.length ? (
          <ul className="workspace-list">
            {view.tasks.map((task) => (
              <li key={task.id} className="workspace-row workspace-item">
                <div>
                  <Link
                    className="text-link workspace-item-title"
                    href={workspaceTaskPath(
                      id,
                      task.id,
                      task.output?.currentVersion || undefined,
                    )}
                  >
                    {task.output?.title ?? task.title}
                  </Link>
                  <p className="muted">
                    {author(view, task.ownerId)} ·{" "}
                    {task.output?.currentVersion
                      ? `Version ${task.output.currentVersion}`
                      : "Awaiting a submission"}
                  </p>
                </div>
                <span className="workspace-status">
                  {staffing(view.project, task)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Add a task on the plan to make its output here.</p>
        )}
      </section>
      <section className="workspace-panel">
        <h2>Shared context</h2>
        {contribute && (
          <details>
            <summary>Add a note or reference</summary>
            <Action
              id={id}
              path={path}
              kind="NOTE_ADDED"
              label="Add to shared context"
            >
              <Field label="Note title" name="title" maxLength={100} />
              <Field
                label="What the team should know"
                name="body"
                rows={4}
                maxLength={10000}
              />
              <Field
                label="Reference URL (optional)"
                name="url"
                type="url"
                maxLength={2000}
                required={false}
              />
            </Action>
          </details>
        )}
        {!view.notes.length && <p>No shared context yet.</p>}
        <ul className="workspace-list">
          {view.notes.map((note) => (
            <li id={`note-${note.id}`} className="workspace-item" key={note.id}>
              <h3>{note.title}</h3>
              <p className="muted">{author(view, note.authorId)}</p>
              <DocumentText body={note.body} />
              {note.url && (
                <a
                  className="text-link"
                  href={note.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open external reference
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Deliveries({
  view,
  path,
  manage,
}: {
  view: WorkspaceView;
  path: string;
  manage: boolean;
}) {
  const { project, releases, tasks } = view;
  const previous = releases.find(
    (release) => !release.approvedAt && !release.supersededAt,
  );
  const blockers = tasks.filter(
    (task) =>
      task.required &&
      (task.status !== "COMPLETE" ||
        task.blockers.length ||
        task.inputs.some((input) => !input.latest || input.changed)),
  );
  const questions = view.projectQuestions.filter(
    (post) => !post.taskId && post.blocking && !post.answeredAt,
  );
  return (
    <div className="workspace-stack">
      {manage && (
        <section className="workspace-panel">
          <h2>Prepare delivery</h2>
          <p>
            Select the completed outputs that belong in this package. Required
            work appears selected.
          </p>
          {blockers.length > 0 && (
            <>
              <h3>Work to finish</h3>
              <ul className="workspace-list">
                {blockers.map((task) => (
                  <li key={task.id}>
                    <Link
                      className="text-link"
                      href={workspaceTaskPath(project.id, task.id)}
                    >
                      {task.title}
                    </Link>{" "}
                    · {staffing(project, task)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {questions.map((question) => (
            <p key={question.id}>
              <Link
                className="text-link"
                href={`/projects/${project.id}/questions/${question.id}`}
              >
                {question.body}
              </Link>
            </p>
          ))}
          {tasks.some(
            (task) => task.status === "COMPLETE" && task.output?.currentVersion,
          ) && (
            <Action
              id={project.id}
              path={path}
              kind="RELEASE_PREPARED"
              label={
                previous
                  ? "Replace pending package"
                  : "Submit package for approval"
              }
              values={previous ? { previousId: previous.id } : undefined}
            >
              <Field
                label="Package title"
                name="title"
                value={project.title}
                maxLength={100}
              />
              <MemberSelect
                view={view}
                name="approverId"
                label="Release approver"
                value={previous?.approverId ?? project.creatorAccountId}
                human
                required
              />
              <fieldset className="workspace-fieldset">
                <legend>Versions for delivery</legend>
                {tasks.map(
                  (task) =>
                    task.output &&
                    task.output.currentVersion > 0 && (
                      <label className="workspace-check" key={task.id}>
                        <input
                          type="checkbox"
                          name="selection"
                          value={`${task.id}:${task.output.currentVersion}`}
                          defaultChecked={
                            task.required && task.status === "COMPLETE"
                          }
                          disabled={task.status !== "COMPLETE"}
                        />
                        {task.output.title} v{task.output.currentVersion}
                        {task.required ? " · Required" : " · Optional"}
                      </label>
                    ),
                )}
              </fieldset>
            </Action>
          )}
        </section>
      )}
      <section className="workspace-panel">
        <h2>Delivery history</h2>
        {releases.length ? (
          <ul className="workspace-list">
            {releases.map((release) => (
              <li className="workspace-item workspace-row" key={release.id}>
                <Link
                  className="text-link"
                  href={`/projects/${project.id}/delivery/${release.id}`}
                >
                  {release.title}
                </Link>
                <span className="workspace-status">
                  {release.approvedAt
                    ? "Approved"
                    : release.supersededAt
                      ? "Superseded or returned"
                      : "Awaiting approval"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>The approved package will appear here.</p>
        )}
      </section>
    </div>
  );
}

export function Package({
  view,
  path,
  contribute,
}: {
  view: WorkspaceView;
  path: string;
  contribute: boolean;
}) {
  const { release, items, project, releaseEvents } = view;
  if (!release) return null;
  const decide =
    contribute &&
    !release.approvedAt &&
    !release.supersededAt &&
    view.actor.accountId === release.approverId;
  const discussions = view.relatedQuestions;
  return (
    <div className="workspace-stack workspace-print">
      <section className="workspace-panel">
        <div className="workspace-row">
          <h2>{release.title}</h2>
          <span className="workspace-status">
            {release.approvedAt
              ? "Approved package"
              : release.supersededAt
                ? "Previous submission"
                : "Awaiting human approval"}
          </span>
        </div>
        <p className="project-copy">{view.manifest?.brief}</p>
        <p>
          <strong>Success criteria</strong> · {project.doneWhen}
        </p>
        <p>
          Prepared by {author(view, release.submittedById)} ·{" "}
          {release.approvedAt ? "Approved by" : "Assigned to"}{" "}
          {author(view, release.approverId)}
        </p>
        <ul className="workspace-list">
          {items.map((item) => (
            <li key={item.taskId}>
              <Link
                className="text-link"
                href={workspaceTaskPath(project.id, item.taskId, item.version)}
              >
                {item.title} v{item.version}
              </Link>
              {item.saved.changeSummary && <p>{item.saved.changeSummary}</p>}
            </li>
          ))}
        </ul>
        {release.approvedAt && (
          <div className="workspace-print-hide workspace-inline">
            <a href={`${path}/download`} className="button">
              Download Markdown
            </a>
            <DeliveryTools markdown={packageMarkdown(release.title, items)} />
          </div>
        )}
      </section>
      {items.map((item) => (
        <section className="workspace-panel" key={item.taskId}>
          <h2>
            {item.title} · Version {item.version}
          </h2>
          <p className="muted">
            Submitted by {author(view, item.saved.authorId)} ·{" "}
            {readinessLabels[item.saved.readiness]}
          </p>
          <DocumentText body={item.saved.body} />
          {item.signoffs.map((event, index) => (
            <p key={index} className="workspace-answer">
              <strong>
                {author(view, event.actorId)}{" "}
                {event.kind === "RECOMMENDED" ? "recommended" : "approved"}:
              </strong>{" "}
              {event.note}
            </p>
          ))}
        </section>
      ))}
      {discussions.length > 0 && (
        <section className="workspace-panel workspace-print-hide">
          <h2>Related decisions</h2>
          <ul className="workspace-list">
            {discussions
              .filter((post) => post.responderId)
              .map((post) => (
                <li className="workspace-item" key={post.id}>
                  <Link
                    className="text-link"
                    href={`/projects/${project.id}/questions/${post.id}`}
                  >
                    {post.body}
                  </Link>{" "}
                  · {post.answeredAt ? "Answered" : "Waiting for an answer"}
                </li>
              ))}
          </ul>
        </section>
      )}
      {releaseEvents
        .filter((event) => event.note)
        .map((event) => (
          <p className="workspace-answer" key={event.id}>
            {author(view, event.actorId)} returned the package. {event.note}
          </p>
        ))}
      {decide && (
        <section className="workspace-panel workspace-print-hide">
          <h2>Your approval</h2>
          <Action
            id={project.id}
            path={path}
            kind="RELEASE_APPROVED"
            label="Approve package"
            values={{ releaseId: release.id }}
          />
          <details>
            <summary>Return for changes</summary>
            <Action
              id={project.id}
              path={path}
              kind="RELEASE_RETURNED"
              label="Return package"
              values={{ releaseId: release.id }}
            >
              <Field
                label="What needs to change?"
                name="body"
                rows={3}
                maxLength={1500}
              />
            </Action>
          </details>
        </section>
      )}
    </div>
  );
}
