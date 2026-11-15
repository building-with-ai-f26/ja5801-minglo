CREATE TABLE "AnalyticsPreference" (
  "accountId" TEXT NOT NULL,
  "analyticsId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "policyVersion" INTEGER NOT NULL DEFAULT 1,
  "approvedByAccountId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsPreference_pkey" PRIMARY KEY ("accountId"),
  CONSTRAINT "AnalyticsPreference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AnalyticsPreference_approvedByAccountId_fkey" FOREIGN KEY ("approvedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AnalyticsPreference_analyticsId_key" ON "AnalyticsPreference"("analyticsId");
