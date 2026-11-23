import { createHash } from "node:crypto";
import type { Prisma, WorkspaceReadiness } from "@prisma/client";
import { z } from "zod";
import { ProjectError, requireUnblocked, requireUnpaused } from "../projects";
import { db } from "../db";

export { ProjectError, requireUnblocked, requireUnpaused };
export const workspaceId = z.string().regex(/^[a-z][a-z0-9]{24}$/);
export const operation = z.uuid();
export const count = z.number().int().min(0);
export const versionNumber = z.number().int().positive();
export const text = (max: number) => z.string().trim().min(1).max(max);
export const date = z.iso.date();
export const readiness = z.enum(["SUBMITTED", "RECOMMENDED", "APPROVED"]);
export const taskFields = z.object({
  title: text(100),
  brief: text(3000),
  doneWhen: text(1500),
});
export const workspaceFlag = () => process.env.MINGLO_PROJECTS_V2 !== "false";
export const rank: Record<WorkspaceReadiness, number> = {
  SUBMITTED: 0,
  RECOMMENDED: 1,
  APPROVED: 2,
};
export type Tx = Prisma.TransactionClient;
export const memberAccount = {
  id: true,
  handle: true,
  type: true,
  agent: { select: { participationPausedAt: true } },
} as const;

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ProjectError("Check the required fields and try again.");
  return result.data;
}

export function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function ensure(
  ok: unknown,
  message = "This project or action is unavailable.",
): asserts ok {
  if (!ok) throw new ProjectError(message);
}

export async function lockWorkspace(tx: Tx, projectId: string) {
  // Every mutating path takes the project row before pairs, agents and task
  // writes. The lock orders membership changes with drafts, review and exports.
  await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
  return tx.project.findUnique({
    where: { id: projectId },
    include: {
      memberships: {
        include: { account: { select: memberAccount } },
        where: { status: { in: ["ACCEPTED", "INVITED"] } },
      },
    },
  });
}

export type Workspace = NonNullable<Awaited<ReturnType<typeof lockWorkspace>>>;
export type WorkspaceMember = Workspace["memberships"][number];
export type WorkspaceContext = {
  tx: Tx;
  project: Workspace;
  actorId: string;
  member: WorkspaceMember;
  lead: boolean;
};

export function memberFor(project: Workspace, accountId: string | undefined) {
  return project.memberships.find(
    (member) => member.accountId === accountId && member.status === "ACCEPTED",
  );
}

export function canContribute(
  project: Workspace,
  accountId: string | undefined,
) {
  const member = memberFor(project, accountId);
  return member &&
    (member.contributor || project.creatorAccountId === accountId)
    ? member
    : undefined;
}

export async function workspaceFormat(accountId: string, projectId: string) {
  return db.project.findFirst({
    where: {
      id: projectId,
      memberships: { some: { accountId, status: "ACCEPTED" } },
    },
    select: { workspaceFormat: true, creatorAccountId: true },
  });
}

const manifestItems = z
  .array(
    z.object({
      taskId: workspaceId,
      outputId: workspaceId,
      version: versionNumber,
      title: text(120),
    }),
  )
  .min(1)
  .max(40);

export const manifestSchema = z.object({
  brief: text(3000),
  doneWhen: text(1500),
  items: manifestItems,
});

export function markdownLink(value: string) {
  try {
    const link = new URL(value);
    return ["http:", "https:"].includes(link.protocol) &&
      !link.username &&
      !link.password
      ? link.href
      : null;
  } catch {
    return null;
  }
}
