import { analyticsTransaction } from "./analytics/server";
import { z } from "zod";
import type { AgentRoutine } from "@prisma/client";
import { recordActivity } from "./activity";

export const ROUTINE_SETUP_VERSION = 1;
export const routineLabels = {
  NEEDS_SETUP: "Setup needed",
  NEEDS_APPROVAL: "Host approval needed",
  REPORTED_READY: "Host task reported",
  UNAVAILABLE: "Host cannot run ongoing tasks",
  PAUSED: "Host task reported stopped",
} as const;
export const routineSchema = z
  .object({
    host: z.enum(["MUSE", "DOT", "OTHER"]),
    status: z.enum([
      "NEEDS_APPROVAL",
      "REPORTED_READY",
      "UNAVAILABLE",
      "PAUSED",
    ]),
    intervalMinutes: z.coerce.number().int().min(1).max(1440),
    taskReference: z.string().trim().max(200),
  })
  .superRefine((value, ctx) => {
    if (value.status === "REPORTED_READY" && !value.taskReference)
      ctx.addIssue({
        code: "custom",
        path: ["taskReference"],
        message:
          "Add the task name or ID confirmed by your host before reporting setup.",
      });
  });
export class RoutineError extends Error {}
export function needsRoutineSetup(routine: AgentRoutine | null | undefined) {
  return (
    !routine ||
    routine.setupVersion !== ROUTINE_SETUP_VERSION ||
    routine.status === "NEEDS_SETUP"
  );
}
export async function saveRoutineReport(accountId: string, input: unknown) {
  const parsed = routineSchema.safeParse(input);
  if (!parsed.success) throw new RoutineError(parsed.error.issues[0].message);
  return analyticsTransaction(accountId, async (tx, record) => {
    const agent = await tx.agent.findUnique({
      where: { accountId },
      select: { id: true },
    });
    if (!agent)
      throw new RoutineError("Only an agent can report its own host setup.");
    await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "id" = ${agent.id} FOR UPDATE`;
    const before = await tx.agentRoutine.findUnique({
      where: { agentId: agent.id },
    });
    const data = {
      ...parsed.data,
      setupVersion: ROUTINE_SETUP_VERSION,
      reportedAt: parsed.data.status === "REPORTED_READY" ? new Date() : null,
      // A setup report is not evidence of a later visit.
      lastCheckAt: null,
    };
    const result = await tx.agentRoutine.upsert({
      where: { agentId: agent.id },
      create: { agentId: agent.id, ...data },
      update: data,
    });
    if (before?.status !== result.status)
      record(
        "routine_status_changed",
        { reported_status: parsed.data.status },
        `${agent.id}:${result.updatedAt.toISOString()}`,
        result.updatedAt,
      );
    return result;
  });
}

export async function recordRoutineCheck(accountId: string) {
  await analyticsTransaction(accountId, async (tx, record) => {
    const result = await tx.agentRoutine.updateMany({
      where: {
        agent: { accountId },
        status: "REPORTED_READY",
        setupVersion: ROUTINE_SETUP_VERSION,
      },
      data: { lastCheckAt: new Date() },
    });
    if (!result.count)
      throw new RoutineError(
        "Report a confirmed host task before recording a return visit.",
      );
    await recordActivity(accountId, { client: tx, force: true });
    record("agent_checkin_recorded", {});
  });
}
