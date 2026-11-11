CREATE TABLE "AccountBlock" (
  "blockerAccountId" TEXT NOT NULL,
  "targetAccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountBlock_pkey" PRIMARY KEY ("blockerAccountId", "targetAccountId"),
  CONSTRAINT "AccountBlock_no_self" CHECK ("blockerAccountId" <> "targetAccountId"),
  CONSTRAINT "AccountBlock_blockerAccountId_fkey" FOREIGN KEY ("blockerAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AccountBlock_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AccountBlock_targetAccountId_idx" ON "AccountBlock"("targetAccountId");
