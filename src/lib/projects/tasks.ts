import { z } from "zod";
import type { Prisma, WorkspaceReadiness } from "@prisma/client";
import {
  canContribute,
  count,
  ensure,
  rank,
  readiness,
  requireUnblocked,
  requireUnpaused,
  text,
  versionNumber,
  workspaceId,
  type Tx,
  type WorkspaceContext,
} from "./shared";

const subject = z.object({ taskId: workspaceId, revision: count });
const current = subject.extend({ version: versionNumber });
const writing = subject.extend({
  version: count,
  draftRevision: count,
  body: text(32000),
});

export const taskCommands = [
  subject.extend({
    kind: z.literal("ASSIGNED"),
    ownerId: workspaceId.optional(),
    reviewerId: workspaceId.optional(),
    approverId: workspaceId.optional(),
    readiness,
  }),
  subject.extend({ kind: z.literal("TAKEN") }),
  subject.extend({ kind: z.literal("REOPENED") }),
  writing.extend({ kind: z.literal("DRAFT_SAVED") }),
  writing.extend({ kind: z.literal("SUBMITTED"), note: text(1500) }),
  current.extend({ kind: z.literal("RECOMMENDED"), note: text(1500) }),
  current.extend({
    kind: z.literal("CHANGES_REQUESTED"),
    note: text(1500),
    heading: text(160).optional(),
  }),
  current.extend({
    kind: z.literal("TASK_APPROVED"),
    note: text(1500).optional(),
  }),
  subject.extend({
    kind: z.literal("INPUT_RESOLVED"),
    prerequisiteId: workspaceId,
    version: versionNumber,
    keep: z.boolean(),
    note: text(1500).optional(),
  }),
] as const;
type TaskCommand = z.infer<(typeof taskCommands)[number]>;
export const taskRelations = {
  output: true,
  dependencies: {
    include: {
      prerequisite: { select: { id: true, title: true, output: true } },
    },
  },
} satisfies Prisma.WorkspaceTaskInclude;
type Task = Prisma.WorkspaceTaskGetPayload<{ include: typeof taskRelations }>;

export async function taskInputs(tx: Tx, task: Task) {
  return Promise.all(
    task.dependencies.map(async (edge) => {
      const output = edge.prerequisite.output;
      const acceptedReadiness = Object.entries(rank)
        .filter(([, level]) => level >= rank[edge.readiness])
        .map(([kind]) => kind as WorkspaceReadiness);
      const eligible = output
        ? { outputId: output.id, readiness: { in: acceptedReadiness } }
        : null;
      const ready = eligible
        ? await tx.workspaceVersion.findFirst({
            where: eligible,
            orderBy: { number: "desc" },
            select: { number: true },
          })
        : null;
      const pinnedAvailable =
        !edge.pinnedVersion ||
        !!(
          eligible &&
          (ready?.number === edge.pinnedVersion ||
            (await tx.workspaceVersion.findFirst({
              where: { ...eligible, number: edge.pinnedVersion },
              select: { number: true },
            })))
        );
      return {
        taskId: task.id,
        prerequisiteId: edge.prerequisiteId,
        title: edge.prerequisite.title,
        outputId: output?.id,
        outputTitle: output?.title,
        latest: ready?.number ?? null,
        pinned: edge.pinnedVersion,
        pinnedAvailable,
        readiness: edge.readiness,
        reason: edge.reason,
        changed: !!(
          ready &&
          edge.pinnedVersion &&
          (!pinnedAvailable ||
            ready.number > (edge.acknowledgedVersion ?? edge.pinnedVersion))
        ),
      };
    }),
  );
}

export async function openBlockers(tx: Tx, projectId: string, taskId: string) {
  return tx.workspacePost.findMany({
    where: { projectId, taskId, blocking: true, answeredAt: null },
    take: 10,
    select: { id: true, responderId: true, body: true },
  });
}

export async function applyTask(
  { tx, project, actorId, lead, member }: WorkspaceContext,
  command: TaskCommand,
) {
  const task = await tx.workspaceTask.findFirst({
    where: { id: command.taskId, projectId: project.id },
    include: taskRelations,
  });
  ensure(task?.output, "That task is unavailable.");
  ensure(
    task.revision === command.revision,
    "This task changed. Reopen it to compare with your unsent work.",
  );
  const { output } = task;
  const receipt = { taskId: task.id, subject: task.title };
  const patch = (data: Prisma.WorkspaceTaskUncheckedUpdateInput) =>
    tx.workspaceTask.update({
      where: { id: task.id },
      data: { ...data, revision: { increment: 1 } },
    });
  const authorize = async (targetId?: string | null) => {
    if (targetId && canContribute(project, targetId))
      await requireUnblocked(tx, actorId, targetId);
    await requireUnpaused(tx, actorId);
  };
  const changeReadiness = (readiness: WorkspaceReadiness) =>
    tx.workspaceVersion.update({
      where: {
        outputId_number: { outputId: output.id, number: output.currentVersion },
      },
      data: { readiness },
    });
  const checkVersion = (version: number) =>
    ensure(
      version === output.currentVersion,
      "Open the current version to continue.",
    );
  const checkBlockers = async () => {
    ensure(
      !(await openBlockers(tx, project.id, task.id)).length,
      "Answer the blocking question before continuing.",
    );
  };
  const checkInputs = async () => {
    const inputs = await taskInputs(tx, task);
    ensure(
      inputs.every((input) => input.latest),
      "One or more required inputs are still waiting.",
    );
    ensure(
      inputs.every((input) => !input.changed),
      "Resolve the newer input before continuing.",
    );
    return inputs;
  };

  switch (command.kind) {
    case "ASSIGNED": {
      ensure(lead, "Only the project lead can assign work.");
      const { ownerId, reviewerId, approverId, readiness } = command;
      const eligible = (id: string | undefined) =>
        project.memberships.find(
          (entry) => entry.accountId === id && entry.contributor,
        );
      ensure(!ownerId || eligible(ownerId), "Choose a contributor.");
      ensure(
        !reviewerId || (eligible(reviewerId) && ownerId !== reviewerId),
        "Choose a reviewer distinct from the owner.",
      );
      ensure(
        !approverId || eligible(approverId)?.account.type === "OWNER",
        "Choose a human approver.",
      );
      // Pending staffing is allowed and surfaced as waiting. Approvals always
      // come from an accepted member in the assigned role.
      for (const id of [
        ...new Set(
          [ownerId, reviewerId, approverId].filter((id): id is string => !!id),
        ),
      ].sort())
        await requireUnblocked(tx, actorId, id);
      ensure(
        task.status !== "COMPLETE",
        "Reopen the completed task to change assignments.",
      );
      const reReview =
        !!output.currentVersion &&
        (task.status === "REVIEW" || task.status === "APPROVAL") &&
        (reviewerId !== task.reviewerId || readiness !== task.readiness);
      if (reReview) await changeReadiness("SUBMITTED");
      await patch({
        ownerId: ownerId ?? null,
        reviewerId: reviewerId ?? null,
        approverId: approverId ?? null,
        readiness,
        ...(reReview && {
          status:
            reviewerId || readiness === "RECOMMENDED"
              ? "REVIEW"
              : readiness === "APPROVED"
                ? "APPROVAL"
                : "REVISION",
        }),
      });
      return receipt;
    }
    case "TAKEN":
      ensure(
        actorId === task.ownerId && task.status === "OPEN",
        "This task is unavailable to start.",
      );
      await authorize();
      await checkBlockers();
      for (const input of await checkInputs()) {
        await tx.workspaceDependency.update({
          where: {
            taskId_prerequisiteId: {
              taskId: task.id,
              prerequisiteId: input.prerequisiteId,
            },
          },
          data: {
            pinnedVersion: input.latest,
            acknowledgedVersion: null,
            reason: null,
          },
        });
      }
      await patch({ status: "WORKING" });
      return receipt;
    case "REOPENED":
      ensure(
        lead && task.status !== "OPEN",
        "The project lead can reopen started work.",
      );
      await patch({ status: "REVISION" });
      return receipt;
    case "DRAFT_SAVED":
    case "SUBMITTED": {
      ensure(
        actorId === task.ownerId &&
          ["WORKING", "REVISION"].includes(task.status),
        "Only the assigned contributor can write this draft.",
      );
      checkVersion(command.version);
      const where = { taskId_authorId: { taskId: task.id, authorId: actorId } };
      const draft = await tx.workspaceDraft.findUnique({ where });
      ensure(
        command.draftRevision === (draft?.revision ?? 0),
        "A draft was saved elsewhere. Copy your edits and reopen the task to compare.",
      );
      if (command.kind === "DRAFT_SAVED") {
        await authorize();
        await tx.workspaceDraft.upsert({
          where,
          create: {
            taskId: task.id,
            authorId: actorId,
            body: command.body,
            baseVersion: command.version,
            revision: 1,
          },
          update: {
            body: command.body,
            baseVersion: command.version,
            revision: { increment: 1 },
          },
        });
        return receipt;
      }
      const reviewNeeded =
        !!task.reviewerId || task.readiness === "RECOMMENDED";
      const status = reviewNeeded
        ? "REVIEW"
        : task.readiness === "APPROVED"
          ? "APPROVAL"
          : "COMPLETE";
      await authorize(
        reviewNeeded
          ? task.reviewerId
          : status === "APPROVAL"
            ? task.approverId
            : undefined,
      );
      await checkBlockers();
      const inputs = await checkInputs();
      const number = output.currentVersion + 1;
      await tx.workspaceVersion.create({
        data: {
          outputId: output.id,
          number,
          authorId: actorId,
          body: command.body,
          changeSummary: command.note,
          inputs: inputs.map(
            ({ title, prerequisiteId, outputId, pinned, latest }) => ({
              title,
              taskId: prerequisiteId,
              outputId,
              version: pinned ?? latest,
            }),
          ),
        },
      });
      // Reopened tasks may have new inputs that did not exist at first start.
      for (const input of inputs.filter((item) => item.pinned === null))
        await tx.workspaceDependency.update({
          where: {
            taskId_prerequisiteId: {
              taskId: task.id,
              prerequisiteId: input.prerequisiteId,
            },
          },
          data: { pinnedVersion: input.latest },
        });
      await tx.workspaceOutput.update({
        where: { id: output.id },
        data: { currentVersion: number },
      });
      await tx.workspaceDraft.deleteMany({
        where: { taskId: task.id, authorId: actorId },
      });
      await patch({ status });
      return { ...receipt, version: number, note: command.note };
    }
    case "CHANGES_REQUESTED":
    case "RECOMMENDED":
    case "TASK_APPROVED": {
      checkVersion(command.version);
      const reviewer = task.status === "REVIEW" && actorId === task.reviewerId;
      const approver =
        task.status === "APPROVAL" &&
        actorId === task.approverId &&
        member.account.type === "OWNER";
      ensure(
        command.kind === "RECOMMENDED"
          ? reviewer
          : command.kind === "TASK_APPROVED"
            ? approver
            : reviewer || approver,
        "This decision belongs to the assigned reviewer or approver.",
      );
      if (command.kind === "CHANGES_REQUESTED") {
        await authorize(task.ownerId);
        await patch({ status: "REVISION" });
        if (command.heading)
          await tx.workspacePost.create({
            data: {
              projectId: project.id,
              taskId: task.id,
              authorId: actorId,
              body: command.note,
              heading: command.heading,
              version: command.version,
            },
          });
      } else {
        if (command.kind === "RECOMMENDED") {
          const submission = await tx.workspaceVersion.findUnique({
            where: {
              outputId_number: { outputId: output.id, number: command.version },
            },
            select: { authorId: true },
          });
          ensure(
            submission && submission.authorId !== actorId,
            "Ask another contributor to review this version.",
          );
        }
        await authorize(
          command.kind === "RECOMMENDED" && task.readiness === "APPROVED"
            ? task.approverId
            : undefined,
        );
        await checkBlockers();
        await checkInputs();
        await changeReadiness(
          command.kind === "RECOMMENDED" ? "RECOMMENDED" : "APPROVED",
        );
        await patch({
          status:
            command.kind === "RECOMMENDED" && task.readiness === "APPROVED"
              ? "APPROVAL"
              : "COMPLETE",
        });
      }
      return { ...receipt, version: command.version, note: command.note };
    }
    case "INPUT_RESOLVED": {
      ensure(
        actorId === task.ownerId,
        "The downstream owner resolves input changes.",
      );
      await authorize();
      const input = (await taskInputs(tx, task)).find(
        (item) => item.prerequisiteId === command.prerequisiteId,
      );
      ensure(
        input?.changed && input.latest === command.version,
        "This input changed. Open the current comparison.",
      );
      ensure(
        !command.keep || input.pinnedAvailable,
        "The previous version no longer meets the required review.",
      );
      ensure(
        !command.keep || command.note,
        "Explain why the previous version still applies.",
      );
      await tx.workspaceDependency.update({
        where: {
          taskId_prerequisiteId: {
            taskId: task.id,
            prerequisiteId: input.prerequisiteId,
          },
        },
        data: command.keep
          ? { acknowledgedVersion: input.latest, reason: command.note }
          : {
              pinnedVersion: input.latest,
              acknowledgedVersion: null,
              reason: null,
            },
      });
      await patch(
        !command.keep && output.currentVersion ? { status: "REVISION" } : {},
      );
      return {
        ...receipt,
        note: command.note,
        version: output.currentVersion || undefined,
      };
    }
  }
}
