import { db } from "../db";
import { ensure, lockWorkspace, workspaceFlag } from "./shared";

const statuses = {
  SETUP: "OPEN",
  DRAFTING: "WORKING",
  REVISION: "REVISION",
  REVIEW: "REVIEW",
  DECISION: "APPROVAL",
  APPROVED: "COMPLETE",
} as const;

export async function convertWorkspace(projectId: string, actorId: string) {
  ensure(workspaceFlag(), "Project changes are paused.");
  return db.$transaction(async (tx) => {
    const project = await lockWorkspace(tx, projectId);
    ensure(project && project.creatorAccountId === actorId);
    if (project.workspaceFormat === 2) return;
    ensure(project.workspaceFormat === 1);
    const [versions, events] = await Promise.all([
      tx.projectVersion.findMany({
        where: { projectId },
        orderBy: { number: "asc" },
      }),
      tx.projectEvent.findMany({
        where: { projectId },
        orderBy: { revision: "asc" },
      }),
    ]);
    const findRole = (role: string) =>
      project.memberships.find((member) => member.role === role)?.accountId;
    const approval = events.find(
      (event) =>
        event.kind === "APPROVED" && event.version === project.approvedVersion,
    );
    if (project.approvedVersion)
      ensure(approval, "The original approval is unavailable.");
    const task = await tx.workspaceTask.create({
      data: {
        projectId,
        title: project.title,
        brief: project.brief,
        doneWhen: project.doneWhen,
        position: 1,
        legacy: true,
        status: statuses[project.phase],
        readiness: "APPROVED",
        ownerId: findRole("DRAFTER"),
        reviewerId: findRole("REVIEWER"),
        approverId: findRole("APPROVER"),
        output: {
          create: {
            title: project.title,
            currentVersion: project.currentVersion,
          },
        },
      },
      include: { output: true },
    });
    const output = task.output!;
    if (versions.length) {
      await tx.workspaceVersion.createMany({
        data: versions.map((item) => ({
          outputId: output.id,
          number: item.number,
          authorId: item.authorAccountId,
          body: item.body,
          changeSummary: "",
          inputs: [],
          createdAt: item.createdAt,
          readiness:
            item.number === project.approvedVersion
              ? "APPROVED"
              : events.some(
                    (event) =>
                      event.kind === "RECOMMENDED" &&
                      event.version === item.number,
                  )
                ? "RECOMMENDED"
                : "SUBMITTED",
        })),
      });
    }
    const release = approval
      ? await tx.workspaceRelease.create({
          data: {
            projectId,
            title: project.title,
            submittedById: approval.actorAccountId,
            approverId: approval.actorAccountId,
            approvedAt: approval.createdAt,
            createdAt: approval.createdAt,
            manifest: {
              brief: project.brief,
              doneWhen: project.doneWhen,
              items: [
                {
                  taskId: task.id,
                  outputId: output.id,
                  version: approval.version,
                  title: output.title,
                },
              ],
            },
          },
        })
      : null;
    if (events.length)
      await tx.workspaceEvent.createMany({
        data: events.map((event) => ({
          id: event.id,
          projectId,
          actorId: event.actorAccountId,
          kind: event.kind,
          taskId: event.version || event.kind === "TAKEN" ? task.id : null,
          releaseId: event.kind === "APPROVED" ? release?.id : null,
          version: event.version,
          subject: event.targetAccountId,
          note: event.note,
          operationKey: event.operationKey,
          requestHash: event.requestHash,
          createdAt: event.createdAt,
        })),
      });
    await tx.projectMembership.updateMany({
      where: {
        projectId,
        OR: [{ role: { not: "READER" } }, { accountId: actorId }],
      },
      data: { contributor: true },
    });
    await tx.workspaceBrief.create({
      data: {
        projectId,
        number: 0,
        actorId,
        brief: project.brief,
        doneWhen: project.doneWhen,
        createdAt: project.createdAt,
      },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { workspaceFormat: 2, revision: { increment: 1 } },
    });
  });
}
