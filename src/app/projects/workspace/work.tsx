import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { WorkspacePost } from "@prisma/client";
import {
  workspaceTaskPath,
  staffing,
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
import { Assign, TaskFields } from "./plan";
import { Difference, DocumentText } from "./document";
import { DraftEditor } from "./editor";

export function Discussion({
  view,
  path,
  items,
  taskId,
  version,
  contribute,
  manage,
  focused = false,
}: {
  view: WorkspaceView;
  path: string;
  items: WorkspacePost[];
  taskId?: string;
  version?: number;
  contribute: boolean;
  manage: boolean;
  focused?: boolean;
}) {
  const id = view.project.id;
  return (
    <section className="workspace-panel">
      <h2>{focused ? "Decision request" : "Discussion"}</h2>
      {items.length > 0 && (
        <ul className="workspace-list">
          {items.map((post) => (
            <li className="workspace-item" key={post.id}>
              <div className="workspace-row">
                <p>
                  <strong>{author(view, post.authorId)}</strong>
                  {post.responderId &&
                    ` asked ${author(view, post.responderId)}`}
                  {post.blocking &&
                    (post.answeredAt ? " · Resolved" : " · Blocks work")}
                </p>
                {post.responderId && !focused && (
                  <Link
                    className="text-link"
                    href={`/projects/${id}/questions/${post.id}`}
                  >
                    Open question
                  </Link>
                )}
              </div>
              {focused && post.taskId && (
                <Link
                  className="text-link"
                  href={`/projects/${id}/tasks/${post.taskId}`}
                >
                  Open affected task
                </Link>
              )}
              {post.version && post.taskId && (
                <Link
                  className="text-link"
                  href={workspaceTaskPath(id, post.taskId, post.version)}
                >
                  Version {post.version}
                  {post.heading && ` · ${post.heading}`}
                </Link>
              )}
              <p className="project-copy">{post.body}</p>
              {post.answer && (
                <div className="workspace-answer">
                  <strong>{author(view, post.answeredById)} answered</strong>
                  <p className="project-copy">{post.answer}</p>
                </div>
              )}
              {contribute &&
                !post.answeredAt &&
                post.responderId === view.actor.accountId && (
                  <Action
                    id={id}
                    path={path}
                    kind="QUESTION_ANSWERED"
                    label="Send answer"
                    values={{ postId: post.id, revision: post.revision }}
                  >
                    <Field
                      label="Your answer"
                      name="body"
                      rows={3}
                      maxLength={4000}
                    />
                  </Action>
                )}
              {manage && post.responderId && !post.answeredAt && (
                <details>
                  <summary>Reassign question</summary>
                  <Action
                    id={id}
                    path={path}
                    kind="QUESTION_REASSIGNED"
                    label="Change responder"
                    values={{ postId: post.id, revision: post.revision }}
                  >
                    <MemberSelect
                      view={view}
                      name="responderId"
                      label="New responder"
                      required
                    />
                  </Action>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      {contribute && !focused && (
        <div className="workspace-toolbar">
          <details>
            <summary>Add comment</summary>
            <Action
              id={id}
              path={path}
              kind="COMMENTED"
              label="Post comment"
              values={{
                ...(taskId && { taskId }),
                ...(version && { version }),
              }}
            >
              <Field label="Comment" name="body" rows={3} maxLength={4000} />
              {version && (
                <Field
                  label="Heading in this version (optional)"
                  name="heading"
                  maxLength={160}
                  required={false}
                />
              )}
            </Action>
          </details>
          <details>
            <summary>Ask for a decision</summary>
            <Action
              id={id}
              path={path}
              kind="QUESTION_ASKED"
              label="Send question"
              values={taskId ? { taskId } : undefined}
            >
              <Field label="Question" name="body" rows={3} maxLength={4000} />
              <MemberSelect
                view={view}
                name="responderId"
                label="Needs an answer from"
                required
              />
              <label className="workspace-check">
                <input type="checkbox" name="blocking" value="true" /> Block{" "}
                {taskId ? "this task" : "delivery"} until answered
              </label>
            </Action>
          </details>
        </div>
      )}
    </section>
  );
}

export function TaskPage({
  view,
  path,
  manage,
  contribute,
}: {
  view: WorkspaceView;
  path: string;
  manage: boolean;
  contribute: boolean;
}) {
  const { task, current, previous, draft, versionEvents, project } = view;
  if (!task?.output) return null;
  const id = project.id;
  const taskPath = workspaceTaskPath(id, task.id);
  const values = { taskId: task.id, revision: task.revision };
  const owner = contribute && view.actor.accountId === task.ownerId;
  const latest = !current || current.number === task.output.currentVersion;
  const reviewer =
    latest &&
    contribute &&
    view.actor.accountId === task.reviewerId &&
    task.status === "REVIEW";
  const approver =
    latest &&
    contribute &&
    view.actor.accountId === task.approverId &&
    task.status === "APPROVAL";
  const canStart = owner && staffing(project, task) === "Ready";
  const writing =
    owner && latest && ["WORKING", "REVISION"].includes(task.status);
  const keyNotes = view.notes.slice(0, 4);
  return (
    <div className="workspace-stack">
      <section className="workspace-panel workspace-task-brief">
        <div className="workspace-row">
          <h2>Task brief</h2>
          <span className="workspace-status">{staffing(project, task)}</span>
        </div>
        <p className="muted">
          {author(view, task.ownerId)} owns this task ·{" "}
          {readinessLabels[task.readiness]}
          {task.dueOn && ` · Due ${task.dueOn}`}
        </p>
        <p className="project-copy">{task.brief}</p>
        <h3>Done when</h3>
        <p className="project-copy">{task.doneWhen}</p>
        {canStart && (
          <Action
            id={id}
            path={taskPath}
            kind="TAKEN"
            label="Start task"
            values={values}
          />
        )}
      </section>
      {(task.inputs.length > 0 ||
        keyNotes.length > 0 ||
        task.blockers.length > 0) && (
        <section className="workspace-panel">
          <h2>Inputs and blockers</h2>
          <ul className="workspace-list">
            {task.blockers.map((entry) => (
              <li key={entry.id} className="workspace-item">
                <Link
                  className="text-link"
                  href={`/projects/${id}/questions/${entry.id}`}
                >
                  Waiting for a decision from {author(view, entry.responderId)}
                </Link>
              </li>
            ))}
            {task.inputs.map((input) => (
              <li key={input.prerequisiteId} className="workspace-item">
                <Link
                  className="text-link"
                  href={workspaceTaskPath(
                    id,
                    input.prerequisiteId,
                    input.pinned ?? input.latest ?? undefined,
                  )}
                >
                  {input.outputTitle ?? input.title}
                  {(input.pinned ?? input.latest)
                    ? ` v${input.pinned ?? input.latest}`
                    : ""}
                </Link>
                {!input.latest && (
                  <p>
                    Waiting for {readinessLabels[input.readiness].toLowerCase()}{" "}
                    work.
                  </p>
                )}
                {input.changed && (
                  <div>
                    <p>New input available</p>
                    <Link
                      className="text-link"
                      href={workspaceTaskPath(
                        id,
                        input.prerequisiteId,
                        input.latest!,
                      )}
                    >
                      Compare with version {input.latest}
                    </Link>
                    {owner && (
                      <div className="workspace-toolbar">
                        <Action
                          id={id}
                          path={taskPath}
                          kind="INPUT_RESOLVED"
                          label="Adopt new input"
                          values={{
                            ...values,
                            prerequisiteId: input.prerequisiteId,
                            version: input.latest!,
                          }}
                        />
                        {input.pinnedAvailable && (
                          <details>
                            <summary>Keep previous input</summary>
                            <Action
                              id={id}
                              path={taskPath}
                              kind="INPUT_RESOLVED"
                              label="Keep pinned version"
                              values={{
                                ...values,
                                prerequisiteId: input.prerequisiteId,
                                version: input.latest!,
                                keep: "true",
                              }}
                            >
                              <Field
                                label="Why the previous input still applies"
                                name="note"
                                rows={2}
                                maxLength={1500}
                              />
                            </Action>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {input.reason && (
                  <p className="muted">Previous version kept. {input.reason}</p>
                )}
              </li>
            ))}
            {keyNotes.map((note) => (
              <li key={note.id} className="workspace-item">
                <Link
                  className="text-link"
                  href={`/projects/${id}/outputs#note-${note.id}`}
                >
                  {note.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {current && (
        <section className="workspace-panel">
          <div className="workspace-row">
            <h2>
              {task.output.title} · Version {current.number}
            </h2>
            <span className="workspace-status">
              {readinessLabels[current.readiness]}
            </span>
          </div>
          <p className="muted">Submitted by {author(view, current.authorId)}</p>
          {current.changeSummary && <p>{current.changeSummary}</p>}
          <DocumentText body={current.body} />
          {previous && (
            <details open={reviewer || approver}>
              <summary>Compare with version {previous.number}</summary>
              <Difference
                before={previous.body}
                after={current.body}
                beforeLabel={`Version ${previous.number}`}
                afterLabel={`Version ${current.number}`}
              />
            </details>
          )}
          {versionEvents.map((event) => (
            <div className="workspace-answer" key={event.id}>
              <strong>
                {author(view, event.actorId)}{" "}
                {event.kind === "CHANGES_REQUESTED"
                  ? "requested changes"
                  : event.kind === "RECOMMENDED"
                    ? "recommended this version"
                    : "approved this version"}
              </strong>
              {event.note && <p className="project-copy">{event.note}</p>}
            </div>
          ))}
          {Array.isArray(current.inputs) && current.inputs.length > 0 && (
            <div className="workspace-answer">
              <h3>Inputs used in this submission</h3>
              <ul>
                {current.inputs.map((input, index) => {
                  if (
                    !input ||
                    typeof input !== "object" ||
                    Array.isArray(input) ||
                    typeof input.taskId !== "string" ||
                    typeof input.version !== "number" ||
                    typeof input.title !== "string"
                  )
                    return null;
                  return (
                    <li key={index}>
                      <Link
                        className="text-link"
                        href={workspaceTaskPath(
                          id,
                          input.taskId,
                          input.version,
                        )}
                      >
                        {input.title} v{input.version}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <nav className="workspace-inline" aria-label="Output versions">
            {current.number > 1 && (
              <Link
                className="text-link"
                href={workspaceTaskPath(id, task.id, current.number - 1)}
              >
                Previous version
              </Link>
            )}
            {current.number < task.output.currentVersion && (
              <Link
                className="text-link"
                href={workspaceTaskPath(id, task.id, current.number + 1)}
              >
                Next version
              </Link>
            )}
            {!latest && (
              <Link className="text-link" href={taskPath}>
                Current task
              </Link>
            )}
          </nav>
        </section>
      )}
      {writing && (
        <section className="workspace-panel">
          <h2>{draft ? "Continue saved draft" : "Write the output"}</h2>
          <DraftEditor
            key={`${task.id}-${task.revision}-${draft?.revision ?? 0}`}
            projectId={id}
            path={taskPath}
            taskId={task.id}
            revision={task.revision}
            version={task.output.currentVersion}
            draftRevision={draft?.revision ?? 0}
            initialBody={draft?.body ?? current?.body ?? ""}
            operationKey={randomUUID()}
          />
        </section>
      )}
      {(reviewer || approver) && current && (
        <section className="workspace-panel">
          <h2>{reviewer ? "Review this version" : "Decide on this version"}</h2>
          <Action
            id={id}
            path={path}
            kind={reviewer ? "RECOMMENDED" : "TASK_APPROVED"}
            label={`${reviewer ? "Recommend" : "Approve"} version ${current.number}`}
            values={{ ...values, version: current.number }}
          >
            <Field
              label={reviewer ? "Recommendation" : "Approval note (optional)"}
              name="note"
              rows={2}
              required={reviewer}
              maxLength={1500}
            />
          </Action>
          <details>
            <summary>Request changes</summary>
            <Action
              id={id}
              path={path}
              kind="CHANGES_REQUESTED"
              label="Send change request"
              values={{ ...values, version: current.number }}
            >
              <Field
                label="What needs to change?"
                name="note"
                rows={3}
                maxLength={1500}
              />
              <Field
                label="Heading in this version (optional)"
                name="heading"
                maxLength={160}
                required={false}
              />
            </Action>
          </details>
        </section>
      )}
      {manage && (
        <details className="workspace-panel">
          <summary>Manage task</summary>
          {task.status !== "COMPLETE" && (
            <Assign view={view} task={task} path={taskPath} />
          )}
          {task.status !== "OPEN" && (
            <Action
              id={id}
              path={taskPath}
              kind="REOPENED"
              label="Reopen task"
              values={values}
            />
          )}
          <details>
            <summary>Edit task details</summary>
            <Action
              id={id}
              path={taskPath}
              kind="TASK_EDITED"
              label="Save task details"
              values={values}
            >
              <TaskFields view={view} task={task} />
            </Action>
          </details>
          {["OPEN", "REVISION"].includes(task.status) && (
            <>
              <details>
                <summary>Add a required input</summary>
                <Action
                  id={id}
                  path={taskPath}
                  kind="DEPENDENCY_SAVED"
                  label="Save input"
                  values={{ taskId: task.id, revision: project.planRevision }}
                >
                  <label className="field">
                    <span>Prerequisite task</span>
                    <select name="prerequisiteId" required>
                      <option value="">Choose a task</option>
                      {view.tasks
                        .filter((entry) => entry.id !== task.id)
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <ReadinessSelect />
                </Action>
              </details>
              {task.inputs.map((entry) => (
                <Action
                  key={entry.prerequisiteId}
                  id={id}
                  path={taskPath}
                  kind="DEPENDENCY_SAVED"
                  label={`Remove input from ${entry.title}`}
                  values={{
                    taskId: task.id,
                    prerequisiteId: entry.prerequisiteId,
                    revision: project.planRevision,
                    readiness: entry.readiness,
                    remove: "true",
                  }}
                />
              ))}
            </>
          )}
        </details>
      )}
      <Discussion
        view={view}
        path={path}
        items={view.discussion}
        taskId={task.id}
        version={current?.number}
        manage={manage}
        contribute={contribute}
      />
    </div>
  );
}
