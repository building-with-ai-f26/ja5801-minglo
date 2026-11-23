import { Prisma } from "@prisma/client";
import { db } from "../db";
import {
  manifestSchema,
  memberAccount,
  parse,
  workspaceFlag,
  workspaceId,
  type Tx,
  type Workspace,
} from "./shared";
import { openBlockers, taskInputs, taskRelations } from "./tasks";

export type WorkItem = {
  id: string;
  project: string;
  href: string;
  label: string;
  decision: boolean;
  status?: string;
};

export async function workspaceQueue(
  accountId: string,
  options: { limit?: number; workAfter?: string; decisionAfter?: string } = {},
) {
  const limit = options.limit ?? 20;
  const accessible = {
    workspaceFormat: 2,
    closedAt: null,
    memberships: { some: { accountId, status: "ACCEPTED", contributor: true } },
  } satisfies Prisma.ProjectWhereInput;
  if (!workspaceFlag())
    return { work: [], decisions: [], workNext: null, decisionNext: null };
  const project = { select: { title: true } } as const;
  const after = (cursor?: string) => (cursor ? { id: { lt: cursor } } : {});
  const window = { orderBy: { id: "desc" as const }, take: limit + 1 };
  const [tasks, reviews, questions, releases, answers] = await Promise.all([
    db.workspaceTask.findMany({
      where: {
        project: accessible,
        ownerId: accountId,
        status: { in: ["OPEN", "WORKING", "REVISION"] },
        ...after(options.workAfter),
      },
      include: { ...taskRelations, project },
      ...window,
    }),
    db.workspaceTask.findMany({
      where: {
        project: accessible,
        OR: [
          { reviewerId: accountId, status: "REVIEW" },
          { approverId: accountId, status: "APPROVAL" },
        ],
        ...after(options.decisionAfter),
      },
      include: { project, output: { select: { currentVersion: true } } },
      ...window,
    }),
    db.workspacePost.findMany({
      where: {
        project: accessible,
        responderId: accountId,
        answeredAt: null,
        ...after(options.decisionAfter),
      },
      include: { project },
      ...window,
    }),
    db.workspaceRelease.findMany({
      where: {
        project: accessible,
        approverId: accountId,
        approvedAt: null,
        supersededAt: null,
        ...after(options.decisionAfter),
      },
      include: { project },
      ...window,
    }),
    db.workspacePost.findMany({
      where: {
        project: accessible,
        authorId: accountId,
        answeredAt: { not: null },
        ...after(options.workAfter),
      },
      include: { project },
      ...window,
    }),
  ]);
  const visits = await db.workspaceVisit.findMany({
    where: {
      accountId,
      projectId: { in: answers.map((entry) => entry.projectId) },
    },
  });
  const answerEvents = await db.workspaceEvent.findMany({
    where: {
      postId: { in: answers.map((entry) => entry.id) },
      kind: "QUESTION_ANSWERED",
      project: accessible,
    },
    select: { id: true, postId: true },
  });
  const answered = answers.flatMap((entry) => {
    const event = answerEvents.find((item) => item.postId === entry.id);
    const visit = visits.find((seen) => seen.projectId === entry.projectId);
    return event &&
      (!visit || event.id > visit.seenThrough) &&
      (!options.workAfter || event.id < options.workAfter)
      ? [{ event, entry }]
      : [];
  });
  const work: WorkItem[] = [
    ...(await Promise.all(
      tasks.map(async (task) => ({
        id: task.id,
        project: task.project.title,
        href: `/projects/${task.projectId}/tasks/${task.id}`,
        label: task.title,
        decision: false,
        status: (await openBlockers(db, task.projectId, task.id)).length
          ? "Waiting for an answer"
          : (await taskInputs(db, task)).some((input) => !input.latest)
            ? "Waiting for input"
            : task.status === "OPEN"
              ? "Ready to start"
              : task.status === "REVISION"
                ? "Changes requested"
                : "In progress",
      })),
    )),
    ...answered.map(({ entry: post, event }) => ({
      id: event.id,
      project: post.project.title,
      href: `/projects/${post.projectId}/questions/${post.id}`,
      label: "Read the answer to your question",
      decision: false,
    })),
  ];
  const decisions: WorkItem[] = [
    ...reviews.map((item) => ({
      id: item.id,
      project: item.project.title,
      href: workspaceTaskPath(
        item.projectId,
        item.id,
        item.output?.currentVersion || undefined,
      ),
      label: `${item.status === "REVIEW" ? "Review" : "Approve"} ${item.title}`,
      decision: true,
    })),
    ...questions.map((item) => ({
      id: item.id,
      project: item.project.title,
      href: `/projects/${item.projectId}/questions/${item.id}`,
      label: item.body.slice(0, 92),
      decision: true,
    })),
    ...releases.map((item) => ({
      id: item.id,
      project: item.project.title,
      href: `/projects/${item.projectId}/delivery/${item.id}`,
      label: `Approve ${item.title}`,
      decision: true,
    })),
  ];
  const page = (items: WorkItem[]) =>
    items
      .sort((left, right) => right.id.localeCompare(left.id))
      .slice(0, limit);
  const workPage = page(work);
  const decisionPage = page(decisions);
  return {
    work: workPage,
    decisions: decisionPage,
    workNext: work.length > limit ? workPage.at(-1)!.id : null,
    decisionNext: decisions.length > limit ? decisionPage.at(-1)!.id : null,
  };
}

export async function readWorkspace(
  accountId: string,
  projectId: string,
  detail?: {
    taskId?: string;
    version?: number;
    releaseId?: string;
    postId?: string;
    before?: string;
  },
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR SHARE`;
    const actor = await tx.projectMembership.findFirst({
      where: {
        projectId,
        accountId,
        status: "ACCEPTED",
        project: { workspaceFormat: 2 },
      },
      include: { account: { select: memberAccount } },
    });
    if (!actor) return null;
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        memberships: {
          include: { account: { select: memberAccount } },
          where: { status: { in: ["ACCEPTED", "INVITED"] } },
        },
      },
    });
    const [
      tasks,
      milestones,
      notes,
      proposals,
      activity,
      visit,
      releases,
      projectQuestions,
      briefs,
    ] = await Promise.all([
      tx.workspaceTask.findMany({
        where: { projectId },
        include: taskRelations,
        orderBy: { position: "asc" },
      }),
      tx.workspaceMilestone.findMany({
        where: { projectId },
        orderBy: [{ dueOn: "asc" }, { id: "asc" }],
      }),
      tx.workspaceNote.findMany({
        where: { projectId },
        orderBy: { id: "desc" },
        take: 100,
      }),
      tx.workspaceProposal.findMany({
        where: { projectId, status: "OPEN" },
        orderBy: { id: "desc" },
        take: 40,
      }),
      tx.workspaceEvent.findMany({
        where: {
          projectId,
          kind: { not: "DRAFT_SAVED" },
          ...(detail?.before && { id: { lt: detail.before } }),
        },
        orderBy: { id: "desc" },
        take: 21,
      }),
      tx.workspaceVisit.findUnique({
        where: { projectId_accountId: { projectId, accountId } },
      }),
      tx.workspaceRelease.findMany({
        where: { projectId },
        orderBy: { id: "desc" },
        take: 20,
      }),
      tx.workspacePost.findMany({
        where: {
          projectId,
          OR: [
            { taskId: null },
            { responderId: { not: null }, answeredAt: null },
          ],
        },
        orderBy: { id: "desc" },
        take: 30,
      }),
      tx.workspaceBrief.findMany({
        where: { projectId },
        orderBy: { number: "desc" },
        take: 15,
      }),
    ]);
    const openQuestions = await tx.workspacePost.findMany({
      where: { projectId, blocking: true, answeredAt: null },
      select: { id: true, taskId: true, responderId: true },
    });
    const plan = await Promise.all(
      tasks.map(async (task) => ({
        ...task,
        inputs: await taskInputs(tx, task),
        blockers: openQuestions.filter((post) => post.taskId === task.id),
      })),
    );
    const task = plan.find((item) => item.id === detail?.taskId);
    const release = detail?.releaseId
      ? await tx.workspaceRelease.findFirst({
          where: { id: detail.releaseId, projectId },
        })
      : null;
    const post = detail?.postId
      ? await tx.workspacePost.findFirst({
          where: { id: detail.postId, projectId },
        })
      : null;
    const [discussion, draft, versions, items] = await Promise.all([
      task
        ? tx.workspacePost.findMany({
            where: { projectId, taskId: task.id },
            orderBy: { id: "desc" },
            take: 40,
          })
        : [],
      task && task.ownerId === accountId
        ? tx.workspaceDraft.findUnique({
            where: {
              taskId_authorId: { taskId: task.id, authorId: accountId },
            },
          })
        : null,
      task?.output
        ? tx.workspaceVersion.findMany({
            where: { outputId: task.output.id },
            orderBy: { number: "desc" },
            take: 20,
            select: {
              number: true,
              authorId: true,
              changeSummary: true,
              readiness: true,
              createdAt: true,
            },
          })
        : [],
      release
        ? deliveryItems(
            tx,
            projectId,
            release.manifest,
            release.approvedAt ?? release.createdAt,
          )
        : [],
    ]);
    const selected = detail?.version ?? task?.output?.currentVersion ?? 0;
    const current =
      task?.output && selected
        ? await tx.workspaceVersion.findUnique({
            where: {
              outputId_number: { outputId: task.output.id, number: selected },
            },
          })
        : null;
    const previous =
      task?.output && current && current.number > 1
        ? await tx.workspaceVersion.findUnique({
            where: {
              outputId_number: {
                outputId: task.output.id,
                number: current.number - 1,
              },
            },
          })
        : null;
    const versionEvents =
      task && current
        ? await tx.workspaceEvent.findMany({
            where: {
              projectId,
              taskId: task.id,
              version: current.number,
              kind: {
                in: [
                  "RECOMMENDED",
                  "TASK_APPROVED",
                  "APPROVED",
                  "CHANGES_REQUESTED",
                ],
              },
            },
            orderBy: { id: "desc" },
            take: 20,
          })
        : [];
    const releaseEvents = release
      ? await tx.workspaceEvent.findMany({
          where: { projectId, releaseId: release.id },
          orderBy: { id: "desc" },
          take: 10,
        })
      : [];
    const relatedQuestions = release
      ? await tx.workspacePost.findMany({
          where: {
            projectId,
            responderId: { not: null },
            OR: [
              { taskId: null },
              { taskId: { in: items.map((entry) => entry.taskId) } },
            ],
          },
          orderBy: { id: "desc" },
          take: 30,
        })
      : [];
    const actorIds = new Set(
      [
        project.creatorAccountId,
        ...activity.map((entry) => entry.actorId),
        ...[
          ...projectQuestions,
          ...relatedQuestions,
          ...discussion,
          ...(post ? [post] : []),
        ].flatMap((entry) => [
          entry.authorId,
          entry.responderId,
          entry.answeredById,
        ]),
        ...notes.map((entry) => entry.authorId),
        ...proposals.map((entry) => entry.authorId),
        ...items.map((entry) => entry.saved.authorId),
        ...items.flatMap((entry) =>
          entry.signoffs.map((signoff) => signoff.actorId),
        ),
        ...versions.map((entry) => entry.authorId),
        current?.authorId,
        ...versionEvents.map((entry) => entry.actorId),
        ...releaseEvents.map((entry) => entry.actorId),
        release?.approverId,
      ].filter((id): id is string => !!id),
    );
    const names = await tx.account.findMany({
      where: { id: { in: [...actorIds] } },
      select: { id: true, handle: true },
    });
    return {
      project,
      actor,
      tasks: plan,
      milestones,
      notes,
      proposals,
      activity: activity.slice(0, 20),
      activityNext: activity.length > 20 ? activity[19].id : null,
      visit,
      releases,
      projectQuestions,
      briefs,
      task,
      release,
      post,
      discussion,
      draft,
      versions,
      current,
      previous,
      versionEvents,
      releaseEvents,
      relatedQuestions,
      items,
      manifest: release ? parse(manifestSchema, release.manifest) : null,
      names: Object.fromEntries(names.map((entry) => [entry.id, entry.handle])),
    };
  });
}

export type WorkspaceView = NonNullable<
  Awaited<ReturnType<typeof readWorkspace>>
>;
export type WorkspaceTaskView = WorkspaceView["tasks"][number];

async function deliveryItems(
  tx: Tx,
  projectId: string,
  raw: Prisma.JsonValue,
  through: Date,
) {
  return Promise.all(
    parse(manifestSchema, raw).items.map(async (item) => {
      const saved = await tx.workspaceVersion.findFirstOrThrow({
        where: {
          outputId: item.outputId,
          number: item.version,
          output: { taskId: item.taskId, task: { projectId } },
        },
      });
      const signoffs = await tx.workspaceEvent.findMany({
        where: {
          projectId,
          taskId: item.taskId,
          version: item.version,
          createdAt: { lte: through },
          kind: { in: ["RECOMMENDED", "TASK_APPROVED", "APPROVED"] },
        },
        orderBy: { id: "desc" },
        take: 10,
        select: { actorId: true, kind: true, note: true },
      });
      return { ...item, saved, signoffs };
    }),
  );
}

export function workspaceTaskPath(
  projectId: string,
  taskId: string,
  version?: number,
) {
  return `/projects/${projectId}/tasks/${taskId}${version ? `/versions/${version}` : ""}`;
}

export function workspaceCursor(value: unknown) {
  const result = workspaceId.safeParse(value);
  return result.success ? result.data : undefined;
}

export function staffing(project: Workspace, task: WorkspaceTaskView) {
  const joined = (accountId: string | null) =>
    project.memberships.find(
      (member) =>
        member.accountId === accountId && member.status === "ACCEPTED",
    );
  const owner = joined(task.ownerId);
  if (task.status === "COMPLETE") return "Completed";
  if (task.status === "REVIEW")
    return joined(task.reviewerId) ? "Needs review" : "Waiting for a reviewer";
  if (task.status === "APPROVAL")
    return joined(task.approverId)
      ? "Needs approval"
      : "Waiting for an approver";
  if (!owner)
    return task.ownerId ? "Waiting for assignee to join" : "Unassigned";
  if (owner.account.agent?.participationPausedAt)
    return "Assigned agent paused";
  if (task.blockers.length) return "Waiting for an answer";
  const missing = task.inputs.find((input) => !input.latest);
  if (missing) return `Waiting for ${missing.title}`;
  if (task.inputs.some((input) => input.changed)) return "New input available";
  return {
    OPEN: "Ready",
    WORKING: "In progress",
    REVISION: "Changes requested",
  }[task.status];
}
