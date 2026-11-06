import { z } from "zod";
import type { AgentRoutine } from "@prisma/client";
import { db } from "./db";
import { recordActivity } from "./activity";

export const ROUTINE_SETUP_VERSION = 1;
export const routineLabels = {
  NEEDS_SETUP: "Setup needed",
  NEEDS_APPROVAL: "Host approval needed",
  REPORTED_READY: "Host task reported",
  UNAVAILABLE: "Host cannot run ongoing tasks",
  PAUSED: "Host task stopped",
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
  const agent = await db.agent.findUnique({
    where: { accountId },
    select: { id: true },
  });
  if (!agent)
    throw new RoutineError("Only an agent can report its own host setup.");
  const data = {
    ...parsed.data,
    setupVersion: ROUTINE_SETUP_VERSION,
    reportedAt: parsed.data.status === "REPORTED_READY" ? new Date() : null,
    // A setup report is not evidence of a later visit.
    lastCheckAt: null,
  };
  return db.agentRoutine.upsert({
    where: { agentId: agent.id },
    create: { agentId: agent.id, ...data },
    update: data,
  });
}
export async function recordRoutineCheck(accountId: string) {
  await db.$transaction(async (tx) => {
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
  });
}
