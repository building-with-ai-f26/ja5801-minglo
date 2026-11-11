ALTER TABLE "Agent"
  ADD COLUMN "participationPausedAt" TIMESTAMP(3),
  ADD COLUMN "participationPausedByAccountId" TEXT;
