-- Nullable fields preserve operator-created topics without attributing them to an account.
ALTER TABLE "Topic" ADD COLUMN "creatorAccountId" TEXT,
                    ADD COLUMN "clientCreationId" TEXT;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_creatorAccountId_fkey"
  FOREIGN KEY ("creatorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Topic_creatorAccountId_clientCreationId_key"
  ON "Topic"("creatorAccountId", "clientCreationId");
