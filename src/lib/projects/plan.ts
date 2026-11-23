import { z } from "zod";
import { db } from "../db";
import { allowAttempt } from "../rate-limit";
import { recordActivity } from "../activity";
import { handleSchema } from "../validation";
import {
  count,
  date,
  digest,
  ensure,
  operation,
  parse,
  readiness,
  requireUnblocked,
  requireUnpaused,
  taskFields,
  text,
  workspaceFlag,
  workspaceId,
  type WorkspaceContext,
} from "./shared";

export const workshopStarter = [
  {
    title: "Draft the facilitator agenda",
    brief: "Lay out a 60-minute workshop for first-time facilitators.",
    doneWhen:
      "The agenda totals 60 minutes and includes a break or transition.",
    output: "Facilitator agenda",
  },
  {
    title: "Design the exercises",
    brief:
      "Write the participant exercises, materials list, and facilitator notes.",
    doneWhen: "Each exercise has a goal, instructions, and a time limit.",
    output: "Exercise sheet",
  },
  {
    title: "Write the participant handout",
    brief: "Turn the exercise sheet into a handout learners can follow.",
    doneWhen: "A participant can complete the exercises using the handout.",
    output: "Participant handout",
  },
];

const projectFields = z.object({
  title: text(80),
  brief: text(3000),
  doneWhen: text(1500),
  dueOn: date.optional(),
});
const creation = projectFields.extend({
  operationKey: operation,
  template: z.enum(["blank", "workshop"]),
  starter: z
    .array(taskFields.extend({ output: text(120) }))
    .length(3)
    .optional(),
});

export async function createWorkspace(actorId: string, input: unknown) {
  ensure(workspaceFlag(), "New workspaces are paused.");
  const { operationKey, template, starter, ...fields } = parse(creation, input);
  const creationHash = digest({ fields, template, starter });
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${actorId} FOR UPDATE`;
    ensure(
      (
        await tx.account.findUnique({
          where: { id: actorId },
          select: { type: true },
        })
      )?.type === "OWNER",
    );
    const prior = await tx.project.findUnique({
      where: {
        creatorAccountId_creationKey: {
          creatorAccountId: actorId,
          creationKey: operationKey,
        },
      },
    });
    if (prior) {
      ensure(
        prior.creationHash === creationHash,
        "This creation action was already used.",
      );
      return prior.id;
    }
    ensure(
      await allowAttempt("create-project", actorId, 10, tx, 86_400),
      "You’ve reached today’s project creation limit.",
    );
    const project = await tx.project.create({
      data: {
        ...fields,
        creatorAccountId: actorId,
        creationKey: operationKey,
        creationHash,
        workspaceFormat: 2,
        memberships: {
          create: {
            accountId: actorId,
            status: "ACCEPTED",
            contributor: true,
            role: "APPROVER",
          },
        },
        workspaceBriefs: {
          create: {
            number: 0,
            actorId,
            brief: fields.brief,
            doneWhen: fields.doneWhen,
          },
        },
      },
    });
    if (template === "workshop") {
      const milestone = await tx.workspaceMilestone.create({
        data: {
          projectId: project.id,
          title: "Workshop kit",
          dueOn: fields.dueOn,
        },
      });
      const tasks = [];
      for (const [index, item] of (starter ?? workshopStarter).entries()) {
        const { output, ...task } = item;
        tasks.push(
          await tx.workspaceTask.create({
            data: {
              ...task,
              projectId: project.id,
              milestoneId: milestone.id,
              position: index + 1,
              readiness: index === 2 ? "SUBMITTED" : "RECOMMENDED",
              output: { create: { title: output } },
            },
          }),
        );
      }
      await tx.workspaceDependency.create({
        data: {
          taskId: tasks[2].id,
          prerequisiteId: tasks[1].id,
          readiness: "RECOMMENDED",
        },
      });
    }
    await recordActivity(actorId, { client: tx, force: true });
    return project.id;
  });
}

const planRevision = z.object({ revision: count });
const taskDetails = taskFields.extend({
  output: text(120),
  dueOn: date.optional(),
  milestoneId: workspaceId.optional(),
  required: z.boolean(),
});
export const planCommands = [
  projectFields.extend({ kind: z.literal("BRIEF_EDITED"), revision: count }),
  taskDetails.extend({ kind: z.literal("TASK_ADDED"), revision: count }),
  taskDetails.extend({
    kind: z.literal("TASK_EDITED"),
    taskId: workspaceId,
    revision: count,
  }),
  planRevision.extend({
    kind: z.literal("TASK_MOVED"),
    taskId: workspaceId,
    direction: z.enum(["up", "down"]),
  }),
  planRevision.extend({
    kind: z.literal("MILESTONE_SAVED"),
    milestoneId: workspaceId.optional(),
    title: text(100),
    dueOn: date.optional(),
  }),
  planRevision.extend({
    kind: z.literal("DEPENDENCY_SAVED"),
    taskId: workspaceId,
    prerequisiteId: workspaceId,
    readiness,
    remove: z.boolean(),
  }),
  taskFields.extend({
    kind: z.literal("PROPOSED"),
    scope: z.enum(["TASK", "BRIEF"]),
    revision: count,
  }),
  taskFields.extend({
    kind: z.literal("PROPOSAL_RESOLVED"),
    proposalId: workspaceId,
    revision: count,
    accept: z.boolean(),
  }),
  z.object({
    kind: z.literal("INVITED"),
    handle: handleSchema,
    contributor: z.boolean(),
  }),
  z.object({ kind: z.literal("REMOVED"), memberId: workspaceId }),
  z.object({ kind: z.literal("LEFT") }),
  z.object({ kind: z.literal("CLOSED") }),
] as const;
type PlanCommand = z.infer<(typeof planCommands)[number]>;

export async function applyPlan(
  { tx, project, lead, actorId }: WorkspaceContext,
  command: PlanCommand,
) {
  const projectId = project.id;
  const planChanged = async () => {
    await tx.project.update({
      where: { id: projectId },
      data: { planRevision: { increment: 1 } },
    });
  };
  const checkPlan = (revision: number) =>
    ensure(
      revision === project.planRevision,
      "The plan changed. Reopen it to compare your edits.",
    );
  const getTask = async (id: string) => {
    const task = await tx.workspaceTask.findFirst({ where: { id, projectId } });
    ensure(task, "That task is unavailable.");
    return task;
  };
  const checkMilestone = async (id: string | undefined) => {
    if (id)
      ensure(
        await tx.workspaceMilestone.findFirst({ where: { id, projectId } }),
        "Choose a milestone in this project.",
      );
  };
  const addTask = async (values: z.infer<typeof taskDetails>) => {
    await checkMilestone(values.milestoneId);
    const aggregate = await tx.workspaceTask.aggregate({
      where: { projectId },
      _count: true,
      _max: { position: true },
    });
    ensure(aggregate._count < 40, "This project already has 40 tasks.");
    const { output, ...fields } = values;
    const task = await tx.workspaceTask.create({
      data: {
        ...fields,
        projectId,
        position: (aggregate._max.position ?? 0) + 1,
        output: { create: { title: output } },
      },
    });
    await planChanged();
    return task.id;
  };
  if (command.kind !== "LEFT" && command.kind !== "PROPOSED")
    ensure(lead, "Only the project lead can change this part of the plan.");
  if (command.kind !== "LEFT") await requireUnpaused(tx, actorId);

  switch (command.kind) {
    case "BRIEF_EDITED": {
      const { kind, revision, ...fields } = command;
      checkPlan(revision);
      await tx.project.update({
        where: { id: projectId },
        data: {
          ...fields,
          dueOn: fields.dueOn ?? null,
          planRevision: { increment: 1 },
        },
      });
      await tx.workspaceBrief.create({
        data: {
          projectId,
          actorId,
          number: revision + 1,
          brief: fields.brief,
          doneWhen: fields.doneWhen,
        },
      });
      return {};
    }
    case "TASK_ADDED": {
      const { kind, revision, ...fields } = command;
      checkPlan(revision);
      return { taskId: await addTask(fields), subject: fields.title };
    }
    case "TASK_EDITED": {
      const { kind, revision, taskId, output, ...fields } = command;
      const task = await getTask(taskId);
      ensure(
        task.revision === revision,
        "The task changed. Reopen it to compare your edits.",
      );
      await checkMilestone(fields.milestoneId);
      await tx.workspaceTask.update({
        where: { id: taskId },
        data: {
          ...fields,
          dueOn: fields.dueOn ?? null,
          milestoneId: fields.milestoneId ?? null,
          ...((fields.brief !== task.brief ||
            fields.doneWhen !== task.doneWhen) &&
            ["REVIEW", "APPROVAL", "COMPLETE"].includes(task.status) && {
              status: "REVISION",
            }),
          revision: { increment: 1 },
          output: { update: { title: output } },
        },
      });
      await planChanged();
      return { taskId, subject: fields.title };
    }
    case "TASK_MOVED": {
      checkPlan(command.revision);
      const task = await getTask(command.taskId);
      const up = command.direction === "up";
      const adjacent = await tx.workspaceTask.findFirst({
        where: {
          projectId,
          milestoneId: task.milestoneId,
          position: up ? { lt: task.position } : { gt: task.position },
        },
        orderBy: { position: up ? "desc" : "asc" },
      });
      ensure(adjacent, "This task is already at the end of its group.");
      await tx.workspaceTask.update({
        where: { id: task.id },
        data: { position: adjacent.position },
      });
      await tx.workspaceTask.update({
        where: { id: adjacent.id },
        data: { position: task.position },
      });
      await planChanged();
      return { taskId: task.id, subject: task.title };
    }
    case "MILESTONE_SAVED": {
      checkPlan(command.revision);
      const { milestoneId, title, dueOn } = command;
      await checkMilestone(milestoneId);
      if (milestoneId)
        await tx.workspaceMilestone.update({
          where: { id: milestoneId },
          data: { title, dueOn: dueOn ?? null },
        });
      else {
        ensure(
          (await tx.workspaceMilestone.count({ where: { projectId } })) < 20,
          "This project already has 20 milestones.",
        );
        await tx.workspaceMilestone.create({
          data: { projectId, title, dueOn },
        });
      }
      await planChanged();
      return { subject: title };
    }
    case "DEPENDENCY_SAVED": {
      checkPlan(command.revision);
      const { taskId, prerequisiteId, remove } = command;
      const task = await getTask(taskId);
      const prerequisite = await getTask(prerequisiteId);
      ensure(taskId !== prerequisiteId, "A task cannot be its own input.");
      ensure(
        task.status === "OPEN" || task.status === "REVISION",
        "Reopen the task before changing its required inputs.",
      );
      const where = { taskId_prerequisiteId: { taskId, prerequisiteId } };
      if (remove)
        await tx.workspaceDependency.deleteMany({
          where: { taskId, prerequisiteId },
        });
      else {
        const edges = await tx.workspaceDependency.findMany({
          where: { task: { projectId } },
        });
        const remaining = [prerequisiteId];
        const visited = new Set<string>();
        while (remaining.length) {
          const next = remaining.pop()!;
          ensure(next !== taskId, "This input would create a cycle.");
          if (visited.has(next)) continue;
          visited.add(next);
          for (const edge of edges)
            if (edge.taskId === next) remaining.push(edge.prerequisiteId);
        }
        await tx.workspaceDependency.upsert({
          where,
          create: { taskId, prerequisiteId, readiness: command.readiness },
          update: {
            readiness: command.readiness,
            pinnedVersion: null,
            acknowledgedVersion: null,
            reason: null,
          },
        });
      }
      await tx.workspaceTask.update({
        where: { id: taskId },
        data: { revision: { increment: 1 } },
      });
      await planChanged();
      return { taskId, subject: prerequisite.title };
    }
    case "PROPOSED": {
      checkPlan(command.revision);
      const { scope, title, brief, doneWhen } = command;
      ensure(
        (await tx.workspaceProposal.count({
          where: { projectId, status: "OPEN" },
        })) < 40,
        "Resolve an open proposal before adding more.",
      );
      const proposal = await tx.workspaceProposal.create({
        data: {
          projectId,
          authorId: actorId,
          scope,
          title,
          brief,
          doneWhen,
          baseRevision: command.revision,
        },
      });
      return { subject: proposal.id, note: title };
    }
    case "PROPOSAL_RESOLVED": {
      checkPlan(command.revision);
      const proposal = await tx.workspaceProposal.findFirst({
        where: { id: command.proposalId, projectId, status: "OPEN" },
      });
      ensure(proposal, "This proposal was already resolved.");
      const { title, brief, doneWhen } = command;
      let taskId: string | undefined;
      if (command.accept && proposal.scope === "TASK")
        taskId = await addTask({
          title,
          brief,
          doneWhen,
          output: title,
          required: true,
        });
      if (command.accept && proposal.scope === "BRIEF") {
        await tx.project.update({
          where: { id: projectId },
          data: { brief, doneWhen, planRevision: { increment: 1 } },
        });
        await tx.workspaceBrief.create({
          data: {
            projectId,
            actorId,
            number: command.revision + 1,
            brief,
            doneWhen,
          },
        });
      }
      await tx.workspaceProposal.update({
        where: { id: proposal.id },
        data: { status: command.accept ? "ADOPTED" : "DECLINED" },
      });
      return {
        taskId,
        subject: proposal.id,
        note: command.accept ? "Adopted" : "Declined",
      };
    }
    case "INVITED": {
      const target = await tx.account.findUnique({
        where: { handle: command.handle },
        select: { id: true },
      });
      ensure(
        target &&
          !project.memberships.some((member) => member.accountId === target.id),
        "Choose a person or agent who has no active membership or invitation.",
      );
      await requireUnblocked(tx, actorId, target.id);
      ensure(
        project.memberships.length < 24,
        "This project already has 24 members or invitations.",
      );
      ensure(
        await allowAttempt("project-invite", actorId, 24, tx),
        "Wait before sending more invitations.",
      );
      const member = await tx.projectMembership.upsert({
        where: { projectId_accountId: { projectId, accountId: target.id } },
        create: {
          projectId,
          accountId: target.id,
          contributor: command.contributor,
        },
        update: {
          status: "INVITED",
          contributor: command.contributor,
          generation: { increment: 1 },
        },
      });
      return { subject: member.accountId };
    }
    case "LEFT":
    case "REMOVED": {
      const member = project.memberships.find((member) =>
        command.kind === "LEFT"
          ? member.accountId === actorId
          : member.id === command.memberId,
      );
      ensure(
        member && member.accountId !== project.creatorAccountId,
        "The project lead can close the project.",
      );
      const target = member.accountId;
      await tx.projectMembership.update({
        where: { id: member.id },
        data: { status: command.kind === "LEFT" ? "LEFT" : "REMOVED" },
      });
      const invalidReviews = await tx.workspaceTask.findMany({
        where: { projectId, reviewerId: target, status: "APPROVAL" },
        select: {
          id: true,
          output: { select: { id: true, currentVersion: true } },
        },
      });
      for (const task of invalidReviews) {
        await tx.workspaceTask.update({
          where: { id: task.id },
          data: { status: "REVIEW" },
        });
        if (task.output?.currentVersion)
          await tx.workspaceVersion.update({
            where: {
              outputId_number: {
                outputId: task.output.id,
                number: task.output.currentVersion,
              },
            },
            data: { readiness: "SUBMITTED" },
          });
      }
      for (const field of ["ownerId", "reviewerId", "approverId"] as const) {
        await tx.workspaceTask.updateMany({
          where: { projectId, [field]: target, status: { not: "COMPLETE" } },
          data: {
            [field]: null,
            revision: { increment: 1 },
            ...(field === "ownerId" && { status: "REVISION" }),
          },
        });
      }
      await tx.workspacePost.updateMany({
        where: { projectId, responderId: target, answeredAt: null },
        data: { revision: { increment: 1 } },
      });
      return { subject: target };
    }
    case "CLOSED":
      await tx.projectMembership.updateMany({
        where: { projectId, status: "INVITED" },
        data: { status: "REMOVED" },
      });
      await tx.project.update({
        where: { id: projectId },
        data: { closedAt: new Date() },
      });
      return {};
  }
}
