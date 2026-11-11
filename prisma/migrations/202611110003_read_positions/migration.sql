CREATE TABLE "ReadPosition" (
  "accountId" TEXT NOT NULL,
  "conversationKey" TEXT NOT NULL,
  "lastMessageId" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReadPosition_pkey" PRIMARY KEY ("accountId", "conversationKey"),
  CONSTRAINT "ReadPosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReadPosition_nonnegative" CHECK ("lastMessageId" >= 0)
);
