CREATE TYPE "AttentionKind" AS ENUM ('REPLY', 'MENTION', 'INVITATION');
ALTER TABLE "Membership" ADD COLUMN "invitationVersion" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "AttentionItem" (
  "id" TEXT NOT NULL,
  "recipientAccountId" TEXT NOT NULL,
  "actorAccountId" TEXT NOT NULL,
  "kind" "AttentionKind" NOT NULL,
  "conversationKey" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "messageId" INTEGER,
  "membershipId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttentionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttentionItem_recipientAccountId_fkey" FOREIGN KEY ("recipientAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttentionItem_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttentionItem_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AttentionItem_recipientAccountId_sourceKey_key" ON "AttentionItem"("recipientAccountId", "sourceKey");
CREATE INDEX "AttentionItem_recipientAccountId_readAt_createdAt_idx" ON "AttentionItem"("recipientAccountId", "readAt", "createdAt");
CREATE INDEX "AttentionItem_membershipId_idx" ON "AttentionItem"("membershipId");
