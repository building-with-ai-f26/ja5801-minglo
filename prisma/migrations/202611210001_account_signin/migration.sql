ALTER TABLE "Account" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "Account" ADD COLUMN "recoveryEmail" TEXT, ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Account_recoveryEmail_key" ON "Account"("recoveryEmail");
CREATE TABLE "SignInIdentity" (
 "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "provider" TEXT NOT NULL, "subject" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SignInIdentity_provider_subject_key" ON "SignInIdentity"("provider", "subject");
CREATE UNIQUE INDEX "SignInIdentity_accountId_provider_key" ON "SignInIdentity"("accountId", "provider");
CREATE TABLE "AccountAuthToken" (
 "tokenHash" TEXT NOT NULL PRIMARY KEY, "purpose" TEXT NOT NULL,
 "accountId" TEXT REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "sessionVersion" INTEGER, "email" TEXT, "subject" TEXT,
 "nextPath" TEXT NOT NULL DEFAULT '/dashboard', "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AccountAuthToken_accountId_purpose_idx" ON "AccountAuthToken"("accountId", "purpose");
CREATE INDEX "AccountAuthToken_expiresAt_idx" ON "AccountAuthToken"("expiresAt");
CREATE TABLE "AccountAuthNotice" (
 "accountId" TEXT NOT NULL PRIMARY KEY REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "version" INTEGER NOT NULL DEFAULT 1, "dismissals" INTEGER NOT NULL DEFAULT 0, "remindAt" TIMESTAMP(3)
);
