-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicFollow" (
    "accountId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicFollow_pkey" PRIMARY KEY ("accountId","topicId")
);

-- CreateTable
CREATE TABLE "DiscussionThread" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "creatorAccountId" TEXT NOT NULL,
    "clientCreationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "DiscussionThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionMessage" (
    "id" SERIAL NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderAccountId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "replyToId" INTEGER,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicModerationAction" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_createdAt_id_idx" ON "Topic"("createdAt", "id");

-- CreateIndex
CREATE INDEX "TopicFollow_topicId_idx" ON "TopicFollow"("topicId");

-- CreateIndex
CREATE INDEX "DiscussionThread_topicId_lastActivityAt_id_idx" ON "DiscussionThread"("topicId", "lastActivityAt", "id");

-- CreateIndex
CREATE INDEX "DiscussionThread_topicId_createdAt_id_idx" ON "DiscussionThread"("topicId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionThread_creatorAccountId_clientCreationId_key" ON "DiscussionThread"("creatorAccountId", "clientCreationId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionMessage_threadId_senderAccountId_clientMessageId_key" ON "DiscussionMessage"("threadId", "senderAccountId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionMessage_threadId_id_key" ON "DiscussionMessage"("threadId", "id");

-- CreateIndex
CREATE INDEX "TopicModerationAction_targetType_targetId_createdAt_idx" ON "TopicModerationAction"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "TopicFollow" ADD CONSTRAINT "TopicFollow_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicFollow" ADD CONSTRAINT "TopicFollow_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_creatorAccountId_fkey" FOREIGN KEY ("creatorAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DiscussionMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defense in depth: a parent can never come from a different discussion.
ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_same_thread_parent_fkey"
  FOREIGN KEY ("threadId", "replyToId") REFERENCES "DiscussionMessage"("threadId", "id") ON DELETE RESTRICT;
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_title_length" CHECK (length("title") BETWEEN 1 AND 100);
ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_body_length" CHECK (length("body") BETWEEN 1 AND 4000);
ALTER TABLE "TopicModerationAction" ADD CONSTRAINT "TopicModerationAction_target_type" CHECK ("targetType" IN ('TOPIC', 'THREAD', 'MESSAGE'));
ALTER TABLE "TopicModerationAction" ADD CONSTRAINT "TopicModerationAction_operator_reason" CHECK (length("operatorId") BETWEEN 1 AND 100 AND length("reason") BETWEEN 1 AND 500);

-- Stable permalinks, authorship, opening records and retry identities are immutable.
CREATE FUNCTION minglo_discussion_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'DiscussionThread' THEN
    IF (NEW."id", NEW."topicId", NEW."creatorAccountId", NEW."clientCreationId", NEW."title", NEW."createdAt")
       IS DISTINCT FROM (OLD."id", OLD."topicId", OLD."creatorAccountId", OLD."clientCreationId", OLD."title", OLD."createdAt") THEN
      RAISE EXCEPTION 'Discussion identity is immutable';
    END IF;
  ELSE
    IF (NEW."id", NEW."threadId", NEW."senderAccountId", NEW."clientMessageId", NEW."body", NEW."replyToId", NEW."createdAt")
       IS DISTINCT FROM (OLD."id", OLD."threadId", OLD."senderAccountId", OLD."clientMessageId", OLD."body", OLD."replyToId", OLD."createdAt") THEN
      RAISE EXCEPTION 'Discussion message identity is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER discussion_thread_identity_guard BEFORE UPDATE ON "DiscussionThread" FOR EACH ROW EXECUTE FUNCTION minglo_discussion_identity_guard();
CREATE TRIGGER discussion_message_identity_guard BEFORE UPDATE ON "DiscussionMessage" FOR EACH ROW EXECUTE FUNCTION minglo_discussion_identity_guard();

CREATE FUNCTION minglo_topic_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Topic moderation audit is append-only';
END;
$$;
CREATE TRIGGER topic_audit_guard BEFORE UPDATE OR DELETE ON "TopicModerationAction" FOR EACH ROW EXECUTE FUNCTION minglo_topic_audit_guard();

