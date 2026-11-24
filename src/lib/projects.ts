import { createHash } from "node:crypto";
import { Prisma, type ProjectPhase, type ProjectRole } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { lockBlockPair } from "./blocks";
import { recordActivity } from "./activity";
import { allowAttempt } from "./rate-limit";
import { handleSchema } from "./validation";

const text = (max: number) => z.string().trim().min(1).max(max);
const key = z.uuid();
const id = z.string().regex(/^[a-z][a-z0-9]{24}$/);
const revision = z.number().int().min(0);
const version = z.number().int().positive();
const role = z.enum(["DRAFTER", "REVIEWER", "APPROVER", "READER"]);
const brief = z.object({
  title: text(80),
  brief: text(3000),
  doneWhen: text(1000),
});
const decision = z.object({ version, note: text(1000) });
const commands = z.discriminatedUnion("kind", [
  brief.extend({ kind: z.literal("BRIEF_EDITED") }),
  z.object({ kind: z.literal("INVITED"), handle: handleSchema, role }),
  z.object({
    kind: z.literal("JOINED"),
    invitationId: id,
    generation: version,
  }),
  z.object({
    kind: z.literal("DECLINED"),
    invitationId: id,
    generation: version,
  }),
  z.object({ kind: z.literal("LEFT") }),
  z.object({ kind: z.literal("REMOVED"), accountId: id }),
  z.object({
    kind: z.literal("ASSIGNED"),
    accountId: id,
    role: role.exclude(["READER"]),
  }),
  z.object({ kind: z.literal("TAKEN") }),
  z.object({
    kind: z.literal("SUBMITTED"),
    baseVersion: revision,
    body: text(12000),
  }),
  decision.extend({ kind: z.literal("CHANGES_REQUESTED") }),
  decision.extend({ kind: z.literal("RECOMMENDED") }),
  z.object({ kind: z.literal("APPROVED"), version, recommendationId: id }),
  z.object({ kind: z.literal("CLOSED") }),
]);

export class ProjectError extends Error {}
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ProjectError("Check the fields and try again.");
  return result.data;
}

function hash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export const projectRoleLabels = {
  DRAFTER: "Drafting agent",
  REVIEWER: "Reviewing agent",
  APPROVER: "Human approver",
  READER: "Reader",
} satisfies Record<ProjectRole, string>;

const turnRole = {
  SETUP: "DRAFTER",
  DRAFTING: "DRAFTER",
  REVISION: "DRAFTER",
  REVIEW: "REVIEWER",
  DECISION: "APPROVER",
  APPROVED: null,
} satisfies Record<ProjectPhase, ProjectRole | null>;

const requiredRoles = ["DRAFTER", "REVIEWER", "APPROVER"] as const;
const activeStatus = ["ACCEPTED", "INVITED"] as const;
const person = {
  id: true,
  handle: true,
  type: true,
  agent: { select: { participationPausedAt: true } },
} satisfies Prisma.AccountSelect;
type Tx = Prisma.TransactionClient;

function accepted(accountId: string): Prisma.ProjectMembershipWhereInput {
  return { accountId, status: "ACCEPTED" };
}

const hasTeam = {
  AND: requiredRoles.map((role) => ({
    memberships: { some: { role, status: "ACCEPTED" as const } },
  })),
} satisfies Prisma.ProjectWhereInput;

const hasAssignedTeam = {
  AND: requiredRoles.map((role) => ({
    memberships: { some: { role, status: { in: [...activeStatus] } } },
  })),
} satisfies Prisma.ProjectWhereInput;

export async function createProject(actorId: string, input: unknown) {
  const { operationKey, ...values } = validate(
    brief.extend({ operationKey: key }),
    input,
  );
  const creationHash = hash(values);
  return db.$transaction(async (tx) => {
    // Lock before checking the key so simultaneous first submissions return one project.
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${actorId} FOR UPDATE`;
    const actor = await tx.account.findUnique({
      where: { id: actorId },
      select: { type: true },
    });
    if (actor?.type !== "OWNER")
      throw new ProjectError("A person must start the project.");
    const where = {
      creatorAccountId_creationKey: {
        creatorAccountId: actorId,
        creationKey: operationKey,
      },
    };
    const prior = await tx.project.findUnique({ where });
    if (prior) {
      if (prior.creationHash !== creationHash)
        throw new ProjectError("Open a new form to start another project.");
      return { id: prior.id };
    }
    if (!(await allowAttempt("create-project", actorId, 5, tx, 86400)))
      throw new ProjectError("You’ve reached today’s project creation limit.");
    const project = await tx.project.create({
      data: {
        ...values,
        creationHash,
        creationKey: operationKey,
        creatorAccountId: actorId,
        memberships: {
          create: { accountId: actorId, status: "ACCEPTED", role: "APPROVER" },
        },
      },
      select: { id: true },
    });
    await recordActivity(actorId, { client: tx, force: true });
    return project;
  });
}

export async function requireUnblocked(
  tx: Tx,
  actorId: string,
  targetId: string | undefined,
) {
  if (!targetId || actorId === targetId) return;
  await lockBlockPair(tx, actorId, targetId);
  const blocked = await tx.accountBlock.findFirst({
    where: {
      OR: [
        { blockerAccountId: actorId, targetAccountId: targetId },
        { blockerAccountId: targetId, targetAccountId: actorId },
      ],
    },
    select: { blockerAccountId: true },
  });
  if (blocked)
    throw new ProjectError(
      "This handoff is unavailable. Ask the project creator to review the assignments.",
    );
}

export async function requireUnpaused(tx: Tx, actorId: string) {
  const [agent] = await tx.$queryRaw<{ participationPausedAt: Date | null }[]>`
    SELECT "participationPausedAt" FROM "Agent" WHERE "accountId" = ${actorId} FOR UPDATE
  `;
  if (agent?.participationPausedAt)
    throw new ProjectError("Your participation is paused.");
}

function checkRole(type: "OWNER" | "AGENT", role: ProjectRole) {
  if ((role === "DRAFTER" || role === "REVIEWER") && type !== "AGENT")
    throw new ProjectError("Choose an agent for this role.");
  if (role === "APPROVER" && type !== "OWNER")
    throw new ProjectError("Choose a person to approve the work.");
}

export async function changeProject(
  actorId: string,
  projectId: string,
  input: unknown,
) {
  validate(id, projectId);
  const { operationKey, expectedRevision, command } = validate(
    z.object({
      operationKey: key,
      expectedRevision: revision,
      command: commands,
    }),
    input,
  );
  const requestHash = hash({ expectedRevision, command });
  return db.$transaction(async (tx) => {
    // Project lock serializes changes and access revocation. If needed, take a
    // block-pair lock before the Agent lock, matching the direct-message order.
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: {
        memberships: {
          where: { status: { in: [...activeStatus] } },
          include: { account: { select: person } },
        },
      },
    });
    const member = project?.memberships.find((m) => m.accountId === actorId);
    const invitation =
      command.kind === "JOINED" || command.kind === "DECLINED" ? command : null;
    const invitationMatches =
      invitation &&
      member?.id === invitation.invitationId &&
      member.generation === invitation.generation;
    const ownInvite = invitationMatches && member?.status === "INVITED";
    if (!project || (member?.status !== "ACCEPTED" && !ownInvite))
      throw new ProjectError("This project or invitation is unavailable.");
    if (project.workspaceFormat !== 1)
      throw new ProjectError("This project has moved. Reopen it to continue.");

    const prior = await tx.projectEvent.findUnique({
      where: {
        projectId_actorAccountId_operationKey: {
          projectId,
          actorAccountId: actorId,
          operationKey,
        },
      },
      select: { requestHash: true, version: true },
    });
    if (prior) {
      if (prior.requestHash !== requestHash)
        throw new ProjectError(
          "This action was already used. Reopen the project and try again.",
        );
      return { version: prior.version };
    }
    if (project.closedAt && command.kind !== "LEFT")
      throw new ProjectError("This project is closed.");
    if (
      !invitation &&
      command.kind !== "LEFT" &&
      project.revision !== expectedRevision
    )
      throw new ProjectError(
        "The project changed. Reopen it to see the current work.",
      );

    const creator = project.creatorAccountId === actorId;
    const requireCreator = () => {
      if (!creator)
        throw new ProjectError(
          "Only the project creator can make this change.",
        );
    };
    const assigned = (role: ProjectRole) =>
      project.memberships.find((m) => m.role === role);
    const workflow = (phase: ProjectPhase) => {
      if (
        project.phase !== phase ||
        member?.role !== turnRole[phase] ||
        member.status !== "ACCEPTED"
      )
        throw new ProjectError("This action is no longer your turn.");
      if (requiredRoles.some((role) => assigned(role)?.status !== "ACCEPTED"))
        throw new ProjectError(
          "The project is waiting for the required collaborators to join.",
        );
    };
    const exactVersion = (number: number) => {
      if (number !== project.currentVersion)
        throw new ProjectError("Open the current version to take your turn.");
    };
    const patch: Prisma.ProjectUpdateInput = { revision: { increment: 1 } };
    const event: Prisma.ProjectEventUncheckedCreateInput = {
      projectId,
      actorAccountId: actorId,
      kind: command.kind,
      operationKey,
      requestHash,
      revision: project.revision + 1,
    };

    switch (command.kind) {
      case "BRIEF_EDITED": {
        requireCreator();
        if (project.phase !== "SETUP")
          throw new ProjectError("The brief is fixed once drafting starts.");
        patch.title = command.title;
        patch.brief = command.brief;
        patch.doneWhen = command.doneWhen;
        break;
      }
      case "INVITED": {
        requireCreator();
        const target = await tx.account.findUnique({
          where: { handle: command.handle },
          select: person,
        });
        if (
          !target ||
          project.memberships.some((m) => m.accountId === target.id)
        )
          throw new ProjectError(
            "Choose an account with no current invitation or membership.",
          );
        checkRole(target.type, command.role);
        if (
          command.role !== "READER" &&
          (assigned(command.role) || project.phase === "APPROVED")
        )
          throw new ProjectError(
            "Invite them as a reader first, then assign them after they join.",
          );
        if (project.memberships.length >= 8)
          throw new ProjectError(
            "This project has room for eight people and agents.",
          );
        await requireUnblocked(tx, actorId, target.id);
        if (!(await allowAttempt("project-invite", actorId, 20, tx)))
          throw new ProjectError(
            "Too many invitations. Try again in 15 minutes.",
          );
        await tx.projectMembership.upsert({
          where: { projectId_accountId: { projectId, accountId: target.id } },
          create: { projectId, accountId: target.id, role: command.role },
          update: {
            role: command.role,
            status: "INVITED",
            generation: { increment: 1 },
          },
        });
        event.targetAccountId = target.id;
        event.role = command.role;
        break;
      }
      case "JOINED":
      case "DECLINED":
        if (!ownInvite || !member)
          throw new ProjectError("This invitation is no longer pending.");
        if (command.kind === "JOINED") {
          await requireUnblocked(tx, actorId, project.creatorAccountId);
          await requireUnpaused(tx, actorId);
        }
        await tx.projectMembership.update({
          where: { id: member.id },
          data: { status: command.kind === "JOINED" ? "ACCEPTED" : "DECLINED" },
        });
        break;
      case "LEFT":
      case "REMOVED": {
        if (command.kind === "REMOVED") requireCreator();
        const target =
          command.kind === "LEFT"
            ? member
            : project.memberships.find(
                (m) => m.accountId === command.accountId,
              );
        if (!target || target.accountId === project.creatorAccountId)
          throw new ProjectError("The creator can close the project.");
        await tx.projectMembership.update({
          where: { id: target.id },
          data: { status: command.kind === "LEFT" ? "LEFT" : "REMOVED" },
        });
        if (target.role === "REVIEWER" && project.phase === "DECISION") {
          patch.phase = "REVIEW";
          patch.recommendationId = null;
        }
        event.targetAccountId = target.accountId;
        break;
      }
      case "ASSIGNED": {
        requireCreator();
        if (project.phase === "APPROVED")
          throw new ProjectError("The accepted result is sealed.");
        const target = project.memberships.find(
          (m) => m.accountId === command.accountId,
        );
        if (target?.status !== "ACCEPTED" || target.role !== "READER")
          throw new ProjectError(
            "Choose an accepted member who has no other assignment.",
          );
        checkRole(target.account.type, command.role);
        await requireUnblocked(tx, actorId, target.accountId);
        const previous = assigned(command.role);
        if (previous)
          await tx.projectMembership.update({
            where: { id: previous.id },
            data: { role: "READER" },
          });
        await tx.projectMembership.update({
          where: { id: target.id },
          data: { role: command.role },
        });
        if (command.role === "REVIEWER" && project.phase === "DECISION") {
          patch.phase = "REVIEW";
          patch.recommendationId = null;
        }
        event.targetAccountId = target.accountId;
        event.role = command.role;
        break;
      }
      case "TAKEN":
        workflow("SETUP");
        await requireUnpaused(tx, actorId);
        patch.phase = "DRAFTING";
        break;
      case "SUBMITTED": {
        workflow(project.phase === "REVISION" ? "REVISION" : "DRAFTING");
        if (command.baseVersion !== project.currentVersion)
          throw new ProjectError(
            "Reopen the current draft to submit a revision.",
          );
        await requireUnblocked(tx, actorId, assigned("REVIEWER")?.accountId);
        await requireUnpaused(tx, actorId);
        const number = project.currentVersion + 1;
        await tx.projectVersion.create({
          data: {
            projectId,
            number,
            authorAccountId: actorId,
            body: command.body,
          },
        });
        patch.phase = "REVIEW";
        patch.currentVersion = number;
        patch.recommendationId = null;
        event.version = number;
        break;
      }
      case "CHANGES_REQUESTED":
      case "RECOMMENDED": {
        const recommending = command.kind === "RECOMMENDED";
        workflow(
          !recommending && project.phase === "DECISION" ? "DECISION" : "REVIEW",
        );
        exactVersion(command.version);
        await requireUnblocked(
          tx,
          actorId,
          assigned(recommending ? "APPROVER" : "DRAFTER")?.accountId,
        );
        await requireUnpaused(tx, actorId);
        patch.phase = recommending ? "DECISION" : "REVISION";
        patch.recommendationId = null;
        event.version = command.version;
        event.note = command.note;
        break;
      }
      case "APPROVED":
        workflow("DECISION");
        exactVersion(command.version);
        if (project.recommendationId !== command.recommendationId)
          throw new ProjectError(
            "Reopen the decision to read the current recommendation.",
          );
        patch.phase = "APPROVED";
        patch.approvedVersion = command.version;
        event.version = command.version;
        event.recommendationId = command.recommendationId;
        break;
      case "CLOSED":
        requireCreator();
        patch.closedAt = new Date();
        await tx.projectMembership.updateMany({
          where: { projectId, status: "INVITED" },
          data: { status: "REMOVED" },
        });
        break;
    }

    const receipt = await tx.projectEvent.create({
      data: event,
      select: { id: true, version: true },
    });
    if (command.kind === "RECOMMENDED") patch.recommendationId = receipt.id;
    await tx.project.update({ where: { id: projectId }, data: patch });
    await recordActivity(actorId, { client: tx, force: true });
    return { version: receipt.version };
  });
}

export function projectTurnLabel(
  phase: ProjectPhase,
  title: string,
  number: number,
) {
  switch (phase) {
    case "SETUP":
    case "DRAFTING":
      return `Draft ${title}`;
    case "REVISION":
      return `Revise ${title} after version ${number}`;
    case "REVIEW":
      return `Review ${title} · version ${number}`;
    case "DECISION":
      return `Approve version ${number} of ${title}`;
    case "APPROVED":
      return "No action needed";
  }
}

export function projectTurnPath(project: {
  id: string;
  phase: ProjectPhase;
  currentVersion: number;
}) {
  const base = `/projects/${project.id}`;
  switch (project.phase) {
    case "REVIEW":
      return `${base}/versions/${project.currentVersion}`;
    case "DECISION":
      return `${base}/versions/${project.currentVersion}/decision`;
    default:
      return `${base}/task`;
  }
}

export async function getProjectReturns(
  accountId: string,
  options: {
    after?: string;
    all?: boolean;
    kind?: "memberships" | "invitations";
  } = {},
) {
  const turnConditions: Prisma.ProjectMembershipWhereInput[] = Object.entries(
    turnRole,
  ).flatMap(([phase, role]) =>
    role
      ? [{ role, project: { phase: phase as ProjectPhase, ...hasTeam } }]
      : [],
  );
  const take = options.all ? 21 : 4;
  const invited = { status: "INVITED", project: { closedAt: null } } as const;
  const memberships = await db.projectMembership.findMany({
    where: {
      accountId,
      ...(options.after && { id: { lt: options.after } }),
      OR: [
        ...(options.kind !== "memberships" ? [invited] : []),
        ...(options.kind === "invitations"
          ? []
          : [
              options.all
                ? { status: "ACCEPTED" as const }
                : {
                    status: "ACCEPTED" as const,
                    project: { closedAt: null },
                    OR: [
                      ...turnConditions.map((condition) => ({
                        AND: [condition, { project: { workspaceFormat: 1 } }],
                      })),
                      {
                        project: {
                          creatorAccountId: accountId,
                          workspaceFormat: 1,
                          closedAt: null,
                          phase: { not: "APPROVED" as const },
                          NOT: hasAssignedTeam,
                        },
                      },
                    ],
                  },
            ]),
      ],
    },
    select: {
      id: true,
      generation: true,
      status: true,
      role: true,
      project: {
        select: {
          id: true,
          title: true,
          phase: true,
          workspaceFormat: true,
          releases: {
            where: {
              OR: [{ approvedAt: { not: null } }, { supersededAt: null }],
            },
            orderBy: { approvedAt: { sort: "desc", nulls: "last" } },
            take: 1,
            select: { approvedAt: true },
          },
          currentVersion: true,
          closedAt: true,
          memberships: {
            where: {
              status: "ACCEPTED" as const,
              role: { in: [...requiredRoles] },
            },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { id: "desc" },
    take,
  });
  const limit = take - 1;
  const items = memberships
    .slice(0, limit)
    .map(({ id, status, role, generation, project }) => {
      if (status === "INVITED")
        return {
          id,
          href: `/projects/invitations/${id}?generation=${generation}`,
          label: `Review invitation to ${project.title}`,
          invitation: true as const,
        };
      const base = `/projects/${project.id}`;
      const actionable =
        project.workspaceFormat === 1 &&
        !project.closedAt &&
        project.memberships.length === requiredRoles.length &&
        role === turnRole[project.phase];
      if (options.all)
        return {
          id,
          href: base,
          label: project.title,
          status: project.closedAt
            ? "Closed"
            : project.workspaceFormat === 1
              ? project.phase === "APPROVED"
                ? "Accepted result"
                : "In progress"
              : project.releases[0]?.approvedAt
                ? "Approved package"
                : project.releases.length
                  ? "Package awaiting approval"
                  : "In progress",
          action: actionable
            ? {
                href: projectTurnPath(project),
                label: projectTurnLabel(
                  project.phase,
                  project.title,
                  project.currentVersion,
                ),
              }
            : undefined,
        };
      if (!actionable)
        return { id, href: base, label: `Set up ${project.title}` };
      return {
        id,
        href: projectTurnPath(project),
        label: projectTurnLabel(
          project.phase,
          project.title,
          project.currentVersion,
        ),
      };
    });
  const hasProjects =
    items.length > 0 ||
    (!options.all &&
      !!(await db.projectMembership.findFirst({
        where: accepted(accountId),
        select: { id: true },
      })));
  return {
    items,
    hasProjects,
    next: memberships.length > limit ? items[limit - 1].id : null,
  };
}

export function readProjectInvitation(
  accountId: string,
  invitationId: string,
  generation: number,
) {
  return db.projectMembership.findFirst({
    where: {
      id: invitationId,
      accountId,
      generation,
      status: "INVITED",
      project: { closedAt: null },
    },
    select: {
      id: true,
      generation: true,
      role: true,
      contributor: true,
      project: {
        select: {
          id: true,
          title: true,
          revision: true,
          workspaceFormat: true,
          creator: { select: { handle: true } },
        },
      },
    },
  });
}

export async function readProject(
  accountId: string,
  projectId: string,
  selectedVersion?: number,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR SHARE`;
    const project = await tx.project.findFirst({
      where: { id: projectId, memberships: { some: accepted(accountId) } },
      select: {
        id: true,
        creatorAccountId: true,
        title: true,
        brief: true,
        doneWhen: true,
        phase: true,
        revision: true,
        currentVersion: true,
        approvedVersion: true,
        recommendationId: true,
        closedAt: true,
        memberships: {
          where: { status: { in: [...activeStatus] } },
          select: {
            id: true,
            accountId: true,
            role: true,
            status: true,
            account: { select: person },
          },
          orderBy: { createdAt: "asc" },
        },
        events: {
          orderBy: { revision: "desc" },
          take: 30,
          select: {
            id: true,
            kind: true,
            version: true,
            note: true,
            role: true,
            createdAt: true,
            actor: { select: { handle: true } },
            target: { select: { handle: true } },
          },
        },
      },
    });
    if (!project) return null;
    const number =
      selectedVersion ?? project.approvedVersion ?? project.currentVersion;
    const [output, recommendation, requestedChange, approval] =
      await Promise.all([
        number
          ? tx.projectVersion.findUnique({
              where: { projectId_number: { projectId, number } },
              select: {
                number: true,
                body: true,
                createdAt: true,
                author: { select: { handle: true } },
              },
            })
          : null,
        project.recommendationId && number === project.currentVersion
          ? tx.projectEvent.findFirst({
              where: {
                id: project.recommendationId,
                projectId,
                kind: "RECOMMENDED",
                version: number,
              },
              select: {
                id: true,
                note: true,
                createdAt: true,
                actor: { select: { handle: true } },
              },
            })
          : null,
        number
          ? tx.projectEvent.findFirst({
              where: { projectId, kind: "CHANGES_REQUESTED", version: number },
              orderBy: { revision: "desc" },
              select: { note: true, actor: { select: { handle: true } } },
            })
          : null,
        number === project.approvedVersion
          ? tx.projectEvent.findFirst({
              where: { projectId, kind: "APPROVED", version: number },
              select: { createdAt: true, actor: { select: { handle: true } } },
            })
          : null,
      ]);
    const member = project.memberships.find((m) => m.accountId === accountId)!;
    const teamReady = requiredRoles.every((role) =>
      project.memberships.some(
        (m) => m.role === role && m.status === "ACCEPTED",
      ),
    );
    const paused = !!member.account.agent?.participationPausedAt;
    const turn = project.memberships.find(
      (m) => m.role === turnRole[project.phase] && m.status === "ACCEPTED",
    );
    return {
      ...project,
      member,
      teamReady,
      paused,
      turn,
      output,
      recommendation,
      requestedChange,
      approval,
    };
  });
}
