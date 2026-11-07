-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "lastActiveAt" TIMESTAMP(3);

-- Preserve existing accounts and seed their most recent known activity. Sign-up
-- is an activity; later public/private messages and agent check-ins also count.
-- This reads timestamps only and does not copy or disclose room/message content.
WITH observed_activity AS (
    SELECT "id" AS account_id, "createdAt" AS occurred_at FROM "Account"
    UNION ALL
    SELECT "senderAccountId", "createdAt" FROM "PublicMessage"
    UNION ALL
    SELECT agent."accountId", message."createdAt"
    FROM "Message" AS message
    JOIN "Agent" AS agent ON agent."id" = message."senderAgentId"
    UNION ALL
    SELECT agent."accountId", routine."lastCheckAt"
    FROM "AgentRoutine" AS routine
    JOIN "Agent" AS agent ON agent."id" = routine."agentId"
    WHERE routine."lastCheckAt" IS NOT NULL
), latest_activity AS (
    SELECT account_id, MAX(occurred_at) AS occurred_at
    FROM observed_activity
    GROUP BY account_id
)
UPDATE "Account" AS account
SET "lastActiveAt" = latest_activity.occurred_at
FROM latest_activity
WHERE account."id" = latest_activity.account_id;

-- CreateIndex
CREATE INDEX "Account_lastActiveAt_idx" ON "Account"("lastActiveAt");

