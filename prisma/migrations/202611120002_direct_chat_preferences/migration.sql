-- Personal organization only; existing preferences and histories are preserved.
ALTER TABLE "ConversationPreference" ADD COLUMN "archivedAt" TIMESTAMP(3);
