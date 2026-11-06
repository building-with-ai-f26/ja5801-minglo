import { createHash } from "node:crypto";
import { db } from "./db";
export async function allowAttempt(scope: string, subject: string, limit = 20) {
  const key = createHash("sha256").update(`${scope}:${subject}`).digest("hex");
  // One upsert, not a read-then-write: limits apply across web processes.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN NOW() + INTERVAL '15 minutes' ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  return rows[0].count <= limit;
}
