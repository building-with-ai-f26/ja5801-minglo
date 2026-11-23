-- CreateEnum
CREATE TYPE "WorkspaceReadiness" AS ENUM ('SUBMITTED', 'RECOMMENDED', 'APPROVED');

-- CreateEnum
CREATE TYPE "WorkspaceTaskStatus" AS ENUM ('OPEN', 'WORKING', 'REVISION', 'REVIEW', 'APPROVAL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "WorkspaceProposalStatus" AS ENUM ('OPEN', 'ADOPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "dueOn" TEXT,
ADD COLUMN     "planRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workspaceFormat" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ProjectMembership" ADD COLUMN     "contributor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WorkspaceBrief" (
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "doneWhen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceBrief_pkey" PRIMARY KEY ("projectId","number")
);

-- CreateTable
CREATE TABLE "WorkspaceMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueOn" TEXT,

    CONSTRAINT "WorkspaceMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "doneWhen" TEXT NOT NULL,
    "dueOn" TEXT,
    "milestoneId" TEXT,
    "ownerId" TEXT,
    "reviewerId" TEXT,
    "approverId" TEXT,
    "readiness" "WorkspaceReadiness" NOT NULL DEFAULT 'SUBMITTED',
    "status" "WorkspaceTaskStatus" NOT NULL DEFAULT 'OPEN',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "legacy" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkspaceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceDependency" (
    "taskId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,
    "readiness" "WorkspaceReadiness" NOT NULL,
    "pinnedVersion" INTEGER,
    "acknowledgedVersion" INTEGER,
    "reason" TEXT,

    CONSTRAINT "WorkspaceDependency_pkey" PRIMARY KEY ("taskId","prerequisiteId")
);

-- CreateTable
CREATE TABLE "WorkspaceOutput" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkspaceOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceVersion" (
    "outputId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "readiness" "WorkspaceReadiness" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceVersion_pkey" PRIMARY KEY ("outputId","number")
);

-- CreateTable
CREATE TABLE "WorkspaceDraft" (
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "baseVersion" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceDraft_pkey" PRIMARY KEY ("taskId","authorId")
);

-- CreateTable
CREATE TABLE "WorkspaceNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceProposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "doneWhen" TEXT NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "status" "WorkspaceProposalStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspacePost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "authorId" TEXT NOT NULL,
    "responderId" TEXT,
    "body" TEXT NOT NULL,
    "version" INTEGER,
    "heading" TEXT,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "answer" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspacePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceRelease" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "manifest" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "taskId" TEXT,
    "postId" TEXT,
    "releaseId" TEXT,
    "version" INTEGER,
    "subject" TEXT,
    "note" TEXT,
    "operationKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceVisit" (
    "projectId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "seenThrough" TEXT NOT NULL,

    CONSTRAINT "WorkspaceVisit_pkey" PRIMARY KEY ("projectId","accountId")
);

-- CreateIndex
CREATE INDEX "WorkspaceMilestone_projectId_idx" ON "WorkspaceMilestone"("projectId");

-- CreateIndex
CREATE INDEX "WorkspaceTask_projectId_position_idx" ON "WorkspaceTask"("projectId", "position");

-- CreateIndex
CREATE INDEX "WorkspaceTask_projectId_ownerId_status_idx" ON "WorkspaceTask"("projectId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceTask_projectId_reviewerId_status_idx" ON "WorkspaceTask"("projectId", "reviewerId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceTask_projectId_approverId_status_idx" ON "WorkspaceTask"("projectId", "approverId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceDependency_prerequisiteId_idx" ON "WorkspaceDependency"("prerequisiteId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceOutput_taskId_key" ON "WorkspaceOutput"("taskId");

-- CreateIndex
CREATE INDEX "WorkspaceNote_projectId_createdAt_id_idx" ON "WorkspaceNote"("projectId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "WorkspaceProposal_projectId_status_createdAt_idx" ON "WorkspaceProposal"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspacePost_projectId_taskId_createdAt_id_idx" ON "WorkspacePost"("projectId", "taskId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "WorkspacePost_projectId_responderId_answeredAt_idx" ON "WorkspacePost"("projectId", "responderId", "answeredAt");

-- CreateIndex
CREATE INDEX "WorkspaceRelease_projectId_createdAt_id_idx" ON "WorkspaceRelease"("projectId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "WorkspaceRelease_projectId_approverId_approvedAt_idx" ON "WorkspaceRelease"("projectId", "approverId", "approvedAt");

-- CreateIndex
CREATE INDEX "WorkspaceEvent_projectId_id_idx" ON "WorkspaceEvent"("projectId", "id");

-- CreateIndex
CREATE INDEX "WorkspaceEvent_projectId_taskId_version_id_idx" ON "WorkspaceEvent"("projectId", "taskId", "version", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceEvent_projectId_actorId_operationKey_key" ON "WorkspaceEvent"("projectId", "actorId", "operationKey");

-- AddForeignKey
ALTER TABLE "WorkspaceBrief" ADD CONSTRAINT "WorkspaceBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMilestone" ADD CONSTRAINT "WorkspaceMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceTask" ADD CONSTRAINT "WorkspaceTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDependency" ADD CONSTRAINT "WorkspaceDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkspaceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDependency" ADD CONSTRAINT "WorkspaceDependency_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "WorkspaceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceOutput" ADD CONSTRAINT "WorkspaceOutput_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkspaceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceVersion" ADD CONSTRAINT "WorkspaceVersion_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "WorkspaceOutput"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDraft" ADD CONSTRAINT "WorkspaceDraft_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkspaceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceNote" ADD CONSTRAINT "WorkspaceNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProposal" ADD CONSTRAINT "WorkspaceProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePost" ADD CONSTRAINT "WorkspacePost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceRelease" ADD CONSTRAINT "WorkspaceRelease_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceEvent" ADD CONSTRAINT "WorkspaceEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceVisit" ADD CONSTRAINT "WorkspaceVisit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
