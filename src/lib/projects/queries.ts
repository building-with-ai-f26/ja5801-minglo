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
  kind: "work" | "waiting" | "answer" | "decision";
  status?: string;
};

export async function workspaceQueue(
  accountId: string,
  options: {
    projectId?: string;
    limit?: number;
    workAfter?: string;
    decisionAfter?: string;
  } = {},
) {
  const limit = options.limit ?? 20;
  const accessible = {
    id: options.projectId,
    workspaceFormat: 2,
    closedAt: null,
    memberships: { some: { accountId, status: "ACCEPTED", contributor: true } },
  } satisfies Prisma.ProjectWhereInput;
  if (
    !workspaceFlag() ||
    (
      await db.agent.findUnique({
        where: { accountId },
        select: { participationPausedAt: true },
      })
    )?.participationPausedAt
  )
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
        output: { currentVersion: { gt: 0 } },
        ...after(options.decisionAfter),
      },
      include: {
        project,
        output: { select: { currentVersion: true, title: true } },
      },
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
    // Apply the per-project read position and event cursor before bounding answers.
    db.$queryRaw<
      {
        id: string;
        projectId: string;
        project: string;
        postId: string;
        question: string;
      }[]
    >(Prisma.sql`
      SELECT e.id, e."projectId", p.title AS project, e."postId", left(q.body, 92) AS question
      FROM "WorkspaceEvent" e
      JOIN "Project" p ON p.id = e."projectId"
      JOIN "WorkspacePost" q ON q.id = e."postId" AND q."projectId" = p.id
      JOIN "ProjectMembership" m ON m."projectId" = p.id AND m."accountId" = ${accountId}
      LEFT JOIN "WorkspaceVisit" v ON v."projectId" = p.id AND v."accountId" = m."accountId"
      WHERE e.kind = 'QUESTION_ANSWERED' AND q."authorId" = m."accountId"
        AND m.status = 'ACCEPTED' AND m.contributor
        AND p."workspaceFormat" = 2 AND p."closedAt" IS NULL
        AND (v."seenThrough" IS NULL OR e.id > v."seenThrough")
        ${options.projectId ? Prisma.sql`AND p.id = ${options.projectId}` : Prisma.empty}
        ${options.workAfter ? Prisma.sql`AND e.id < ${options.workAfter}` : Prisma.empty}
      ORDER BY e.id DESC LIMIT ${limit + 1}
    `),
  ]);
  const work: WorkItem[] = [
    ...(await Promise.all(
      tasks.map(async (task): Promise<WorkItem> => {
        const [blockers, inputs] = await Promise.all([
          openBlockers(db, task.projectId, task.id),
          taskInputs(db, task),
        ]);
        const blocker = blockers[0];
        const missing = inputs.find((input) => !input.latest);
        const changed = inputs.find((input) => input.changed);
        const path = workspaceTaskPath(task.projectId, task.id);
        if (blocker || missing) {
          const responder = blocker?.responderId
            ? await db.account.findUnique({
                where: { id: blocker.responderId },
                select: { handle: true },
              })
            : null;
          return {
            id: task.id,
            project: task.project.title,
            href: blocker
              ? `/projects/${task.projectId}/questions/${blocker.id}`
              : path,
            label: task.title,
            kind: "waiting",
            status: blocker
              ? responder
                ? `Waiting for an answer from @${responder.handle}`
                : "Waiting for an answer"
              : `Waiting for ${missing?.title}`,
          };
        }
        return {
          id: task.id,
          project: task.project.title,
          href: path,
          label: changed
            ? `Resolve new input for ${task.title}`
            : `${task.status === "OPEN" ? "Start" : task.status === "REVISION" ? "Revise" : "Continue"} · ${task.title}`,
          kind: "work",
        };
      }),
    )),
    ...answers.map((entry): WorkItem => ({
      id: entry.id,
      project: entry.project,
      href: `/projects/${entry.projectId}/questions/${entry.postId}`,
      label: "Read the answer to your question",
      kind: "answer",
      status: entry.question,
    })),
  ];
  const decisions: WorkItem[] = [
    ...reviews
      .filter((item) => item.output?.currentVersion)
      .map((item) => ({
        id: item.id,
        project: item.project.title,
        href: workspaceTaskPath(
          item.projectId,
          item.id,
          item.output?.currentVersion || undefined,
        ),
        label: `${item.status === "REVIEW" ? "Review" : "Approve"} ${item.output?.title ?? item.title} v${item.output?.currentVersion}`,
        kind: "decision" as const,
      })),
    ...questions.map((item) => ({
      id: item.id,
      project: item.project.title,
      href: `/projects/${item.projectId}/questions/${item.id}`,
      label: `Answer “${item.body.length > 92 ? item.body.slice(0, 91) + "…" : item.body}”`,
      kind: "decision" as const,
    })),
    ...releases.map((item) => ({
      id: item.id,
      project: item.project.title,
      href: `/projects/${item.projectId}/delivery/${item.id}`,
      label: `Review ${item.title} for approval`,
      kind: "decision" as const,
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
      latestApproved,
      pendingRelease,
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
      tx.workspaceRelease.findFirst({
        where: { projectId, approvedAt: { not: null } },
        orderBy: [{ approvedAt: "desc" }, { id: "desc" }],
      }),
      tx.workspaceRelease.findFirst({
        where: { projectId, approvedAt: null, supersededAt: null },
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
      select: { id: true, taskId: true, responderId: true, body: true },
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
        release?.submittedById,
        pendingRelease?.approverId,
      ].filter((id): id is string => !!id),
    );
    const names = await tx.account.findMany({
      where: { id: { in: [...actorIds] } },
      select: { id: true, handle: true },
    });
    return {
      project,
      latestApproved,
      pendingRelease,
      deliveryQuestions: openQuestions.filter((post) => !post.taskId),
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
  if (task.status === "REVIEW") {
    const reviewer = joined(task.reviewerId);
    if (!reviewer) return "Waiting for a reviewer";
    return reviewer.account.agent?.participationPausedAt
      ? `Reviewer @${reviewer.account.handle} is paused`
      : `Needs review from @${reviewer.account.handle}`;
  }
  if (task.status === "APPROVAL")
    return joined(task.approverId)
      ? `Needs approval from @${joined(task.approverId)?.account.handle}`
      : "Waiting for an approver";
  if (!owner) {
    const invited = project.memberships.find(
      (member) =>
        member.accountId === task.ownerId && member.status === "INVITED",
    );
    return invited
      ? `Waiting for @${invited.account.handle} to join`
      : "Unassigned";
  }
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
