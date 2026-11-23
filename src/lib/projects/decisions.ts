import { z } from "zod";
import { allowAttempt } from "../rate-limit";
import {
  canContribute,
  count,
  ensure,
  manifestSchema,
  markdownLink,
  parse,
  requireUnblocked,
  requireUnpaused,
  text,
  versionNumber,
  workspaceId,
  type WorkspaceContext,
} from "./shared";
import { openBlockers, taskInputs, taskRelations } from "./tasks";

export const decisionCommands = [
  z.object({
    kind: z.literal("NOTE_ADDED"),
    title: text(100),
    body: text(10000),
    url: z.string().max(2000).optional(),
  }),
  z.object({
    kind: z.literal("COMMENTED"),
    taskId: workspaceId.optional(),
    body: text(4000),
    version: versionNumber.optional(),
    heading: text(160).optional(),
  }),
  z.object({
    kind: z.literal("QUESTION_ASKED"),
    taskId: workspaceId.optional(),
    body: text(4000),
    responderId: workspaceId,
    blocking: z.boolean(),
  }),
  z.object({
    kind: z.literal("QUESTION_ANSWERED"),
    postId: workspaceId,
    revision: count,
    body: text(4000),
  }),
  z.object({
    kind: z.literal("QUESTION_REASSIGNED"),
    postId: workspaceId,
    revision: count,
    responderId: workspaceId,
  }),
  z.object({
    kind: z.literal("RELEASE_PREPARED"),
    title: text(100),
    approverId: workspaceId,
    selections: z
      .array(z.object({ taskId: workspaceId, version: versionNumber }))
      .min(1)
      .max(40),
    previousId: workspaceId.optional(),
  }),
  z.object({ kind: z.literal("RELEASE_APPROVED"), releaseId: workspaceId }),
  z.object({
    kind: z.literal("RELEASE_RETURNED"),
    releaseId: workspaceId,
    body: text(1500),
  }),
] as const;
type DecisionCommand = z.infer<(typeof decisionCommands)[number]>;

async function validateDelivery(
  { tx, project }: WorkspaceContext,
  selected: { taskId: string; version: number }[],
) {
  const tasks = await tx.workspaceTask.findMany({
    where: { projectId: project.id },
    include: taskRelations,
  });
  const selectedIds = new Set(selected.map((item) => item.taskId));
  ensure(selectedIds.size === selected.length, "Choose each deliverable once.");
  ensure(
    tasks
      .filter((task) => task.required)
      .every((task) => selectedIds.has(task.id)),
    "Include every required deliverable.",
  );
  ensure(
    !(await tx.workspacePost.findFirst({
      where: {
        projectId: project.id,
        taskId: null,
        blocking: true,
        answeredAt: null,
      },
      select: { id: true },
    })),
    "Answer the project’s blocking questions first.",
  );
  const manifest = [];
  for (const item of selected) {
    const task = tasks.find((task) => task.id === item.taskId);
    ensure(task?.output, "A selected output is unavailable.");
    ensure(
      task.status === "COMPLETE" && task.output.currentVersion === item.version,
      `“${task.title}” needs its current version completed first.`,
    );
    ensure(
      !(await openBlockers(tx, project.id, task.id)).length,
      `Answer the blocking question on “${task.title}”.`,
    );
    ensure(
      (await taskInputs(tx, task)).every(
        (input) => input.latest && !input.changed,
      ),
      `Resolve the inputs for “${task.title}”.`,
    );
    manifest.push({
      taskId: task.id,
      outputId: task.output.id,
      version: item.version,
      title: task.output.title,
    });
  }
  return manifest;
}

export async function applyDecision(
  ctx: WorkspaceContext,
  command: DecisionCommand,
) {
  const { tx, project, actorId, lead } = ctx;
  const projectId = project.id;
  const authorize = async (target?: string | null) => {
    if (target) await requireUnblocked(tx, actorId, target);
    await requireUnpaused(tx, actorId);
  };

  switch (command.kind) {
    case "NOTE_ADDED": {
      await authorize();
      const link = command.url ? markdownLink(command.url) : null;
      ensure(
        !command.url || link,
        "Enter a valid HTTP or HTTPS reference link.",
      );
      ensure(
        (await tx.workspaceNote.count({ where: { projectId } })) < 100,
        "This project already has 100 context notes.",
      );
      const note = await tx.workspaceNote.create({
        data: {
          projectId,
          authorId: actorId,
          title: command.title,
          body: command.body,
          url: link,
        },
      });
      return { subject: note.id, note: command.title };
    }
    case "COMMENTED":
    case "QUESTION_ASKED": {
      const task = command.taskId
        ? await tx.workspaceTask.findFirst({
            where: { id: command.taskId, projectId },
            include: { output: true },
          })
        : null;
      ensure(!command.taskId || task, "That task is unavailable.");
      const question = command.kind === "QUESTION_ASKED" ? command : undefined;
      const version =
        command.kind === "COMMENTED" ? command.version : undefined;
      if (version)
        ensure(
          task?.output &&
            (await tx.workspaceVersion.findUnique({
              where: {
                outputId_number: { outputId: task.output.id, number: version },
              },
            })),
          "That version is unavailable.",
        );
      if (question)
        ensure(
          canContribute(project, question.responderId),
          "Choose a joined contributor to answer the question.",
        );
      await authorize(question?.responderId);
      ensure(
        await allowAttempt("workspace-discussion", actorId, 30, tx),
        "Wait before adding more discussion.",
      );
      const post = await tx.workspacePost.create({
        data: {
          projectId,
          taskId: task?.id,
          authorId: actorId,
          body: command.body,
          version,
          heading: command.kind === "COMMENTED" ? command.heading : undefined,
          responderId: question?.responderId,
          blocking: question?.blocking,
        },
      });
      return { taskId: task?.id, postId: post.id, version, note: command.body };
    }
    case "QUESTION_ANSWERED":
    case "QUESTION_REASSIGNED": {
      const post = await tx.workspacePost.findFirst({
        where: {
          id: command.postId,
          projectId,
          responderId: { not: null },
          answeredAt: null,
        },
      });
      ensure(
        post && post.revision === command.revision,
        "This question changed. Open it again.",
      );
      if (command.kind === "QUESTION_ANSWERED") {
        ensure(
          post.responderId === actorId,
          "Only the named responder can answer this question.",
        );
        // An answer is shared material. Check the directed relationship if
        // the requester is still a member before sending it back to them.
        await authorize(
          canContribute(project, post.authorId) ? post.authorId : undefined,
        );
        await tx.workspacePost.update({
          where: { id: post.id },
          data: {
            answer: command.body,
            answeredAt: new Date(),
            answeredById: actorId,
            revision: { increment: 1 },
          },
        });
      } else {
        ensure(
          lead && canContribute(project, command.responderId),
          "Choose a joined contributor to answer.",
        );
        await authorize(command.responderId);
        await tx.workspacePost.update({
          where: { id: post.id },
          data: {
            responderId: command.responderId,
            revision: { increment: 1 },
          },
        });
      }
      return {
        taskId: post.taskId ?? undefined,
        postId: post.id,
        note: command.kind === "QUESTION_ANSWERED" ? command.body : undefined,
      };
    }
    case "RELEASE_PREPARED": {
      ensure(lead, "Only the project lead can prepare a delivery.");
      ensure(
        canContribute(project, command.approverId)?.account.type === "OWNER",
        "Choose a joined human approver.",
      );
      await authorize(command.approverId);
      const previous = await tx.workspaceRelease.findFirst({
        where: { projectId, approvedAt: null, supersededAt: null },
        select: { id: true },
      });
      ensure(
        previous?.id === command.previousId,
        "Delivery changed. Open the latest package before preparing another.",
      );
      const manifest = await validateDelivery(ctx, command.selections);
      if (previous)
        await tx.workspaceRelease.update({
          where: { id: previous.id },
          data: { supersededAt: new Date() },
        });
      const release = await tx.workspaceRelease.create({
        data: {
          projectId,
          title: command.title,
          approverId: command.approverId,
          submittedById: actorId,
          manifest: {
            brief: project.brief,
            doneWhen: project.doneWhen,
            items: manifest,
          },
        },
      });
      return { releaseId: release.id, subject: release.title };
    }
    case "RELEASE_APPROVED":
    case "RELEASE_RETURNED": {
      const release = await tx.workspaceRelease.findFirst({
        where: {
          id: command.releaseId,
          projectId,
          approvedAt: null,
          supersededAt: null,
        },
      });
      ensure(release, "This delivery has already changed.");
      ensure(
        release.approverId === actorId && ctx.member.account.type === "OWNER",
        "Only the designated human can decide on this delivery.",
      );
      await authorize(
        command.kind === "RELEASE_RETURNED" ? release.submittedById : undefined,
      );
      if (command.kind === "RELEASE_APPROVED") {
        const manifest = parse(manifestSchema, release.manifest);
        ensure(
          manifest.brief === project.brief &&
            manifest.doneWhen === project.doneWhen,
          "The project brief changed. Prepare a new package before approval.",
        );
        await validateDelivery(ctx, manifest.items);
        await tx.workspaceRelease.update({
          where: { id: release.id },
          data: { approvedAt: new Date() },
        });
      } else
        await tx.workspaceRelease.update({
          where: { id: release.id },
          data: { supersededAt: new Date() },
        });
      return {
        releaseId: release.id,
        subject: release.title,
        note: command.kind === "RELEASE_RETURNED" ? command.body : undefined,
      };
    }
  }
}
