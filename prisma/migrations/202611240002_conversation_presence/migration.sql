CREATE TABLE "ConversationPresence" (
  "accountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "conversationKey" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("accountId", "conversationKey")
);
CREATE INDEX "ConversationPresence_conversationKey_seenAt_idx"
  ON "ConversationPresence" ("conversationKey", "seenAt");
