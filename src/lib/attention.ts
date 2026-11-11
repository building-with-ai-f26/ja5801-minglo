import type { Prisma, AttentionKind } from "@prisma/client";

export class MentionError extends Error {}

export async function recordMessageAttention(
  tx: Prisma.TransactionClient,
  input: {
    actorAccountId: string;
    conversationKey: string;
    messageId: number;
    body: string;
    replyToId?: number;
    roomId?: string;
  },
) {
  const handles = [
    ...new Set(
      [
        ...input.body.matchAll(
          /(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,30})(?![a-zA-Z0-9_])/g,
        ),
      ].map((m) => m[1].toLowerCase()),
    ),
  ];
  if (handles.length > 10)
    throw new MentionError("Mention at most 10 accounts per message.");
  let parentAccountId: string | undefined;
  if (input.replyToId !== undefined) {
    parentAccountId = input.roomId
      ? (
          await tx.message.findUnique({
            where: { id: input.replyToId },
            select: { sender: { select: { accountId: true } } },
          })
        )?.sender.accountId
      : (
          await tx.publicMessage.findUnique({
            where: { id: input.replyToId },
            select: { senderAccountId: true },
          })
        )?.senderAccountId;
  }
  if (!handles.length && !parentAccountId) return;
  const accounts = await tx.account.findMany({
    where: {
      id: { not: input.actorAccountId },
      OR: [
        { handle: { in: handles } },
        ...(parentAccountId ? [{ id: parentAccountId }] : []),
      ],
      ...(input.roomId
        ? {
            AND: {
              OR: [
                { rooms: { some: { id: input.roomId } } },
                {
                  agent: {
                    memberships: {
                      some: { roomId: input.roomId, status: "ACCEPTED" },
                    },
                  },
                },
                {
                  owner: {
                    agents: {
                      some: {
                        memberships: {
                          some: { roomId: input.roomId, status: "ACCEPTED" },
                        },
                      },
                    },
                  },
                },
              ],
            },
          }
        : {}),
    },
    select: { id: true, handle: true },
  });
  await tx.attentionItem.createMany({
    data: accounts.map((account) => ({
      recipientAccountId: account.id,
      actorAccountId: input.actorAccountId,
      kind: (account.id === parentAccountId
        ? "REPLY"
        : "MENTION") as AttentionKind,
      conversationKey: input.conversationKey,
      messageId: input.messageId,
      sourceKey: `message:${input.conversationKey}:${input.messageId}`,
    })),
    skipDuplicates: true,
  });
}

export async function recordInvitationAttention(
  tx: Prisma.TransactionClient,
  input: {
    actorAccountId: string;
    recipientAccountId: string;
    roomId: string;
    membershipId: string;
    version: number;
  },
) {
  if (input.actorAccountId === input.recipientAccountId) return;
  await tx.attentionItem.createMany({
    data: [
      {
        actorAccountId: input.actorAccountId,
        recipientAccountId: input.recipientAccountId,
        kind: "INVITATION",
        conversationKey: `private:${input.roomId}`,
        membershipId: input.membershipId,
        sourceKey: `invitation:${input.membershipId}:${input.version}`,
      },
    ],
    skipDuplicates: true,
  });
}
