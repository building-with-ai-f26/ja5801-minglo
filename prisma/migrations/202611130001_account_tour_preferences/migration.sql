-- Additive only. Existing accounts deliberately receive no automatic offer.
CREATE TYPE "TourStatus" AS ENUM ('UNSEEN', 'OFFERED', 'SKIPPED', 'COMPLETED');
CREATE TABLE "AccountTourPreference" (
    "accountId" TEXT NOT NULL,
    "autoOfferEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "TourStatus" NOT NULL DEFAULT 'UNSEEN',
    "seenVersion" INTEGER,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountTourPreference_pkey" PRIMARY KEY ("accountId")
);
ALTER TABLE "AccountTourPreference" ADD CONSTRAINT "AccountTourPreference_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
