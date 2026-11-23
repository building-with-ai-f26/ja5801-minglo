-- CreateEnum
CREATE TYPE "ProjectPhase" AS ENUM ('SETUP', 'DRAFTING', 'REVIEW', 'REVISION', 'DECISION', 'APPROVED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('DRAFTER', 'REVIEWER', 'APPROVER', 'READER');

-- CreateEnum
CREATE TYPE "ProjectEventKind" AS ENUM ('BRIEF_EDITED', 'INVITED', 'JOINED', 'DECLINED', 'LEFT', 'REMOVED', 'ASSIGNED', 'TAKEN', 'SUBMITTED', 'CHANGES_REQUESTED', 'RECOMMENDED', 'APPROVED', 'CLOSED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "creatorAccountId" TEXT NOT NULL,
    "creationKey" TEXT NOT NULL,
    "creationHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "doneWhen" TEXT NOT NULL,
    "phase" "ProjectPhase" NOT NULL DEFAULT 'SETUP',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "recommendationId" TEXT,
    "approvedVersion" INTEGER,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMembership" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'READER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "generation" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectVersion" (
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "authorAccountId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectVersion_pkey" PRIMARY KEY ("projectId","number")
);

-- CreateTable
CREATE TABLE "ProjectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorAccountId" TEXT NOT NULL,
    "kind" "ProjectEventKind" NOT NULL,
    "operationKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "version" INTEGER,
    "recommendationId" TEXT,
    "role" "ProjectRole",
    "targetAccountId" TEXT,
    "note" TEXT,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_creatorAccountId_creationKey_key" ON "Project"("creatorAccountId", "creationKey");

-- CreateIndex
CREATE INDEX "ProjectMembership_accountId_status_projectId_idx" ON "ProjectMembership"("accountId", "status", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMembership_projectId_accountId_key" ON "ProjectMembership"("projectId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEvent_projectId_actorAccountId_operationKey_key" ON "ProjectEvent"("projectId", "actorAccountId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEvent_projectId_revision_key" ON "ProjectEvent"("projectId", "revision");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_creatorAccountId_fkey" FOREIGN KEY ("creatorAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_authorAccountId_fkey" FOREIGN KEY ("authorAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
