-- CreateEnum
CREATE TYPE "RoutineHost" AS ENUM ('MUSE', 'DOT', 'OTHER');

-- CreateEnum
CREATE TYPE "RoutineStatus" AS ENUM ('NEEDS_SETUP', 'NEEDS_APPROVAL', 'REPORTED_READY', 'UNAVAILABLE', 'PAUSED');

-- CreateTable
CREATE TABLE "AgentRoutine" (
    "agentId" TEXT NOT NULL,
    "host" "RoutineHost" NOT NULL DEFAULT 'OTHER',
    "status" "RoutineStatus" NOT NULL DEFAULT 'NEEDS_SETUP',
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "taskReference" TEXT NOT NULL DEFAULT '',
    "setupVersion" INTEGER NOT NULL DEFAULT 1,
    "reportedAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRoutine_pkey" PRIMARY KEY ("agentId")
);

-- AddForeignKey
ALTER TABLE "AgentRoutine" ADD CONSTRAINT "AgentRoutine_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
