-- CreateEnum
CREATE TYPE "DirectRequestStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttentionKind" ADD VALUE 'DIRECT_REQUEST';
ALTER TYPE "AttentionKind" ADD VALUE 'DIRECT_MESSAGE';

-- AlterTable
ALTER TABLE "AttentionItem" ADD COLUMN     "directConversationId" TEXT,
ADD COLUMN     "requestVersion" INTEGER;

-- CreateTable
CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL,
    "participantLowId" TEXT NOT NULL,
    "participantHighId" TEXT NOT NULL,
    "requestedByAccountId" TEXT NOT NULL,
    "status" "DirectRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" SERIAL NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderAccountId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "requestVersion" INTEGER,
    "replyToId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectConversation_participantHighId_idx" ON "DirectConversation"("participantHighId");

-- CreateIndex
CREATE INDEX "DirectConversation_updatedAt_id_idx" ON "DirectConversation"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_participantLowId_participantHighId_key" ON "DirectConversation"("participantLowId", "participantHighId");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_id_idx" ON "DirectMessage"("conversationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessage_conversationId_senderAccountId_clientMessageI_key" ON "DirectMessage"("conversationId", "senderAccountId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessage_conversationId_requestVersion_key" ON "DirectMessage"("conversationId", "requestVersion");

-- CreateIndex
CREATE INDEX "AttentionItem_directConversationId_idx" ON "AttentionItem"("directConversationId");

-- AddForeignKey
ALTER TABLE "AttentionItem" ADD CONSTRAINT "AttentionItem_directConversationId_fkey" FOREIGN KEY ("directConversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_participantLowId_fkey" FOREIGN KEY ("participantLowId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_participantHighId_fkey" FOREIGN KEY ("participantHighId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_requestedByAccountId_fkey" FOREIGN KEY ("requestedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep the canonical pair and requester valid even if another writer is added later.
ALTER TABLE "DirectConversation"
ADD CONSTRAINT "DirectConversation_canonical_pair" CHECK ("participantLowId" COLLATE "C" < "participantHighId" COLLATE "C"),
ADD CONSTRAINT "DirectConversation_requester_is_participant" CHECK ("requestedByAccountId" IN ("participantLowId", "participantHighId")),
ADD CONSTRAINT "DirectConversation_positive_version" CHECK ("requestVersion" > 0);

CREATE FUNCTION "keep_direct_participants"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."participantLowId" <> OLD."participantLowId" OR NEW."participantHighId" <> OLD."participantHighId" THEN
    RAISE EXCEPTION 'Direct chat participants cannot change';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "DirectConversation_immutable_participants" BEFORE UPDATE ON "DirectConversation"
FOR EACH ROW EXECUTE FUNCTION "keep_direct_participants"();
