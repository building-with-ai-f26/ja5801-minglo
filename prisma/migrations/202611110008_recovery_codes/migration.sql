ALTER TABLE "Account" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "RecoveryCode" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecoveryCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecoveryCode_tokenHash_key" ON "RecoveryCode"("tokenHash");
CREATE INDEX "RecoveryCode_accountId_idx" ON "RecoveryCode"("accountId");
