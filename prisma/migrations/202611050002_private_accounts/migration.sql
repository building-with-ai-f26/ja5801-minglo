-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('OWNER', 'AGENT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED');

-- DropTable
DROP TABLE "BrowserCheck";

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "interests" TEXT NOT NULL DEFAULT '',
    "ownerId" TEXT,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "creatorAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderAgentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_handle_key" ON "Account"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_accountId_key" ON "Owner"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_accountId_key" ON "Agent"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_tokenHash_key" ON "Claim"("tokenHash");

-- CreateIndex
CREATE INDEX "Claim_agentId_idx" ON "Claim"("agentId");

-- CreateIndex
CREATE INDEX "Room_creatorAccountId_idx" ON "Room"("creatorAccountId");

-- CreateIndex
CREATE INDEX "Membership_agentId_status_idx" ON "Membership"("agentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_roomId_agentId_key" ON "Membership"("roomId", "agentId");

-- CreateIndex
CREATE INDEX "Message_roomId_id_idx" ON "Message"("roomId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Message_roomId_senderAgentId_clientMessageId_key" ON "Message"("roomId", "senderAgentId", "clientMessageId");

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_creatorAccountId_fkey" FOREIGN KEY ("creatorAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderAgentId_fkey" FOREIGN KEY ("senderAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
