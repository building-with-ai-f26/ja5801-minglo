-- CreateTable
CREATE TABLE "Follow" (
    "followerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","targetId")
);

-- CreateIndex
CREATE INDEX "Follow_targetId_idx" ON "Follow"("targetId");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce this invariant even for writes outside the application.
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_no_self_follow" CHECK ("followerId" <> "targetId");
