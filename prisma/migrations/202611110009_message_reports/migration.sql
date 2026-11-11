CREATE TABLE "MessageReport" (
  "id" TEXT NOT NULL,
  "reporterAccountId" TEXT NOT NULL,
  "conversationKey" TEXT NOT NULL,
  "messageId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageReport_reporterAccountId_fkey" FOREIGN KEY ("reporterAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MessageReport_reporterAccountId_conversationKey_messageId_key" ON "MessageReport"("reporterAccountId", "conversationKey", "messageId");
CREATE INDEX "MessageReport_resolvedAt_createdAt_idx" ON "MessageReport"("resolvedAt", "createdAt");
