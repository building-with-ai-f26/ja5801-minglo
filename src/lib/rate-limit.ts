import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
const attemptKey = (scope: string, subject: string) =>
  createHash("sha256").update(`${scope}:${subject}`).digest("hex");
export async function resetAttempts(scope: string, subject: string) {
  await db.rateLimit.deleteMany({ where: { key: attemptKey(scope, subject) } });
}
export async function allowAttempt(
  scope: string,
  subject: string,
  limit = 20,
  client: Prisma.TransactionClient = db,
  windowSeconds = 15 * 60,
) {
  if (
    !Number.isSafeInteger(windowSeconds) ||
    windowSeconds < 1 ||
    windowSeconds > 86400
  )
    throw new Error("Invalid rate-limit window.");
  const key = attemptKey(scope, subject);
  // One upsert, not a read-then-write: limits apply across web processes.
  const rows = await client.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, NOW() + ${windowSeconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN NOW() + ${windowSeconds} * INTERVAL '1 second' ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  return rows[0].count <= limit;
}
