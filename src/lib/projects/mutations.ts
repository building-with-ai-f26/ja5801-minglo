import { z } from "zod";
import { db } from "../db";
import { recordActivity } from "../activity";
import {
  ensure,
  digest,
  lockWorkspace,
  operation,
  parse,
  requireUnblocked,
  requireUnpaused,
  versionNumber,
  workspaceFlag,
  workspaceId,
} from "./shared";
import { applyPlan, planCommands } from "./plan";
import { applyTask, taskCommands } from "./tasks";
import { applyDecision, decisionCommands } from "./decisions";

const invitation = z.object({
  kind: z.enum(["JOINED", "DECLINED"]),
  invitationId: workspaceId,
  generation: versionNumber,
});
const commands = z.discriminatedUnion("kind", [
  ...planCommands,
  ...taskCommands,
  ...decisionCommands,
]);
const mutation = z.object({
  operationKey: operation,
  command: z.union([commands, invitation]),
});
const plan = new Set<string>(
  planCommands.map((entry) => entry.shape.kind.value),
);
const tasks = new Set<string>(
  taskCommands.map((entry) => entry.shape.kind.value),
);

export async function changeWorkspace(
  actorId: string,
  projectId: string,
  input: unknown,
) {
  parse(workspaceId, projectId);
  ensure(workspaceFlag(), "Project changes are paused.");
  const { operationKey, command } = parse(mutation, input);
  const requestHash = digest(command);
  return db.$transaction(async (tx) => {
    const project = await lockWorkspace(tx, projectId);
    ensure(project?.workspaceFormat === 2);
    const member = project.memberships.find(
      (entry) => entry.accountId === actorId,
    );
    const isInvite = "invitationId" in command;
    const matched =
      isInvite &&
      member?.id === command.invitationId &&
      member.generation === command.generation;
    ensure(
      member &&
        (isInvite
          ? matched && ["INVITED", "ACCEPTED"].includes(member.status)
          : member.status === "ACCEPTED"),
    );
    const prior = await tx.workspaceEvent.findUnique({
      where: {
        projectId_actorId_operationKey: { projectId, actorId, operationKey },
      },
    });
    if (prior) {
      ensure(
        prior.requestHash === requestHash,
        "This action was already used.",
      );
      return prior;
    }
    const lead = project.creatorAccountId === actorId;
    ensure(
      !project.closedAt || command.kind === "LEFT",
      "This project is closed.",
    );
    const context = { tx, project, actorId, member, lead };
    let result;
    if (isInvite) {
      ensure(
        member.status === "INVITED",
        "This invitation is no longer pending.",
      );
      if (command.kind === "JOINED") {
        await requireUnblocked(tx, actorId, project.creatorAccountId);
        await requireUnpaused(tx, actorId);
      }
      await tx.projectMembership.update({
        where: { id: member.id },
        data: { status: command.kind === "JOINED" ? "ACCEPTED" : "DECLINED" },
      });
      result = {};
    } else {
      ensure(
        lead || member.contributor || command.kind === "LEFT",
        "This membership is read-only.",
      );
      if (plan.has(command.kind))
        result = await applyPlan(
          context,
          command as Parameters<typeof applyPlan>[1],
        );
      else if (tasks.has(command.kind))
        result = await applyTask(
          context,
          command as Parameters<typeof applyTask>[1],
        );
      else
        result = await applyDecision(
          context,
          command as Parameters<typeof applyDecision>[1],
        );
    }
    const receipt = await tx.workspaceEvent.create({
      data: {
        projectId,
        actorId,
        operationKey,
        requestHash,
        kind: command.kind,
        ...result,
      },
    });
    if (command.kind !== "DRAFT_SAVED")
      await recordActivity(actorId, { client: tx, force: true });
    return receipt;
  });
}

export async function markWorkspaceVisited(
  actorId: string,
  projectId: string,
  seenThrough: string,
) {
  return db.$transaction(async (tx) => {
    const project = await lockWorkspace(tx, projectId);
    ensure(
      project?.workspaceFormat === 2 &&
        project.memberships.some(
          (member) =>
            member.accountId === actorId && member.status === "ACCEPTED",
        ),
    );
    const latest = await tx.workspaceEvent.findFirst({
      where: { id: seenThrough, projectId, kind: { not: "DRAFT_SAVED" } },
      select: { id: true },
    });
    ensure(latest, "That activity is unavailable.");
    const key = { projectId_accountId: { projectId, accountId: actorId } };
    const existing = await tx.workspaceVisit.findUnique({ where: key });
    if (!existing || existing.seenThrough < latest.id)
      await tx.workspaceVisit.upsert({
        where: key,
        create: { projectId, accountId: actorId, seenThrough: latest.id },
        update: { seenThrough: latest.id },
      });
  });
}
