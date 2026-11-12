// Trusted infrastructure CLI only. Never import into an HTTP route/action.
// Possession of database/operator process access is the authority, not OWNER.
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

if (!process.env.DATABASE_URL && existsSync(".env"))
  process.loadEnvFile(".env");
const db = new PrismaClient();
const required = z.string().trim().min(1);
const reasonSchema = required.max(500);
const operatorSchema = required.max(100);
const topicSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60),
  name: required.max(80),
  description: required.max(1000),
  rules: required.max(2000),
});
const usage =
  "Usage: topics:moderate create-topic|update-topic|archive-topic|unarchive-topic|hide-thread|unhide-thread|lock-thread|unlock-thread|hide-message|unhide-message|inspect-message|audit --id ID --operator ID --reason TEXT (create: --slug --name --description --rules; update: --name --description --rules; audit: --type TOPIC|THREAD|MESSAGE [--after ID])";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries(
      [
        "id",
        "operator",
        "reason",
        "slug",
        "name",
        "description",
        "rules",
        "type",
        "after",
      ].map((k) => [k, { type: "string" }]),
    ),
  });
  if (positionals.length !== 1) throw new Error(usage);
  const command = positionals[0];
  const commands = [
    "create-topic",
    "update-topic",
    "archive-topic",
    "unarchive-topic",
    "hide-thread",
    "unhide-thread",
    "lock-thread",
    "unlock-thread",
    "hide-message",
    "unhide-message",
    "inspect-message",
    "audit",
  ];
  if (!commands.includes(command)) throw new Error(usage);
  if (command === "audit") {
    const targetId = required.max(100).parse(values.id);
    const targetType = z
      .enum(["TOPIC", "THREAD", "MESSAGE"])
      .parse(values.type);
    const after = values.after
      ? required.max(100).parse(values.after)
      : undefined;
    const rows = await db.topicModerationAction.findMany({
      where: { targetId, targetType, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: "asc" },
      take: 51,
    });
    return {
      actions: rows.slice(0, 50),
      next: rows.length > 50 ? rows[49].id : null,
    };
  }
  const operatorId = operatorSchema.parse(values.operator);
  const reason = reasonSchema.parse(values.reason);
  const targetId =
    command === "create-topic" ? null : required.max(100).parse(values.id);
  const topicData =
    command === "create-topic"
      ? topicSchema.parse(values)
      : command === "update-topic"
        ? topicSchema.omit({ slug: true }).parse(values)
        : null;
  return db.$transaction(async (tx) => {
    // Matches the domain's global -> Topic -> Thread -> Agent order.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(684912, 1)`;
    let targetType = "TOPIC",
      id = targetId,
      changed = true,
      evidence;
    if (command === "create-topic") {
      id = (await tx.topic.create({ data: topicData })).id;
    } else {
      let threadId, topicId, messageId;
      if (command.endsWith("message")) {
        messageId = z.coerce
          .number()
          .int()
          .positive()
          .max(2147483647)
          .parse(targetId);
        const message = await tx.discussionMessage.findUnique({
          where: { id: messageId },
          select: { threadId: true, thread: { select: { topicId: true } } },
        });
        if (!message) throw new Error("Target unavailable.");
        threadId = message.threadId;
        topicId = message.thread.topicId;
        targetType = "MESSAGE";
      } else if (command.endsWith("thread")) {
        threadId = targetId;
        topicId = (
          await tx.discussionThread.findUnique({
            where: { id: threadId },
            select: { topicId: true },
          })
        )?.topicId;
        targetType = "THREAD";
      } else topicId = targetId;
      if (!topicId) throw new Error("Target unavailable.");
      await tx.$queryRaw`SELECT "id" FROM "Topic" WHERE "id" = ${topicId} FOR UPDATE`;
      if (threadId)
        await tx.$queryRaw`SELECT "id" FROM "DiscussionThread" WHERE "id" = ${threadId} FOR UPDATE`;
      if (targetType === "MESSAGE") {
        const message = await tx.discussionMessage.findUniqueOrThrow({
          where: { id: messageId },
        });
        if (command === "inspect-message") {
          evidence = message;
          changed = false;
        } else {
          const hidden = command === "hide-message";
          changed = !!message.hiddenAt !== hidden;
          if (changed)
            await tx.discussionMessage.update({
              where: { id: messageId },
              data: { hiddenAt: hidden ? new Date() : null },
            });
        }
      } else if (targetType === "THREAD") {
        const field = command.includes("lock") ? "lockedAt" : "hiddenAt";
        const enabled = command === "lock-thread" || command === "hide-thread";
        const thread = await tx.discussionThread.findUniqueOrThrow({
          where: { id: threadId },
        });
        changed = !!thread[field] !== enabled;
        if (changed)
          await tx.discussionThread.update({
            where: { id: threadId },
            data: { [field]: enabled ? new Date() : null },
          });
      } else {
        const topic = await tx.topic.findUniqueOrThrow({
          where: { id: topicId },
        });
        if (command === "update-topic") {
          changed = Object.entries(topicData).some(([k, v]) => topic[k] !== v);
          if (changed)
            await tx.topic.update({ where: { id: topicId }, data: topicData });
        } else {
          const archived = command === "archive-topic";
          changed = !!topic.archivedAt !== archived;
          if (changed)
            await tx.topic.update({
              where: { id: topicId },
              data: { archivedAt: archived ? new Date() : null },
            });
        }
      }
    }
    const audit = await tx.topicModerationAction.create({
      data: {
        targetType,
        targetId: id,
        operatorId,
        reason,
        action: command,
        changed,
      },
    });
    return {
      targetType,
      targetId: id,
      action: command,
      changed,
      auditId: audit.id,
      ...(evidence ? { evidence } : {}),
    };
  });
}
try {
  console.log(JSON.stringify(await main(), null, 2));
} catch (error) {
  // No connection strings, SQL or exception payloads in operator output.
  console.error(
    error instanceof z.ZodError
      ? "Invalid command fields. " + usage
      : error instanceof Error &&
          [usage, "Target unavailable."].includes(error.message)
        ? error.message
        : "Topic operation failed. Check the selected database, target, uniqueness and migrations.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
