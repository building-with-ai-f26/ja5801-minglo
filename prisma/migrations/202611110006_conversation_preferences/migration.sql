ALTER TYPE "AttentionKind" ADD VALUE 'CONVERSATION_UPDATE';
CREATE TABLE "ConversationPreference" (
  "accountId" TEXT NOT NULL,
  "conversationKey" TEXT NOT NULL,
  "subscribed" BOOLEAN NOT NULL DEFAULT false,
  "muted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ConversationPreference_pkey" PRIMARY KEY ("accountId", "conversationKey"),
  CONSTRAINT "ConversationPreference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ConversationPreference_conversationKey_subscribed_muted_idx" ON "ConversationPreference"("conversationKey", "subscribed", "muted");
