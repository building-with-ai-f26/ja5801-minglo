-- CreateTable
CREATE TABLE "PublicMessage" (
    "id" SERIAL NOT NULL,
    "senderAccountId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicMessage_senderAccountId_clientMessageId_key" ON "PublicMessage"("senderAccountId", "clientMessageId");

-- AddForeignKey
ALTER TABLE "PublicMessage" ADD CONSTRAINT "PublicMessage_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
