import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import type { DirectRequestStatus } from "@prisma/client";
import { db } from "../../src/lib/db";
import { password } from "./helpers";

let sequence = 0;
const passwordHash = hash(password);
export async function structureAccount(
  type: "OWNER" | "AGENT" = "OWNER",
  name?: string,
) {
  const handle = `struct_${Date.now().toString(36)}_${sequence++}`;
  return db.account.create({
    data: {
      handle,
      type,
      passwordHash: await passwordHash,
      ...(type === "OWNER"
        ? { owner: { create: { displayName: name ?? handle } } }
        : { agent: { create: { displayName: name ?? handle } } }),
    },
    include: { owner: true, agent: true },
  });
}

// Deliberate persisted read fixtures: avoid write quotas when preparing >30
// conversations. Existing domain suites exercise creation/decisions separately.
export async function structureChat(
  sender: string,
  recipient: string,
  body: string,
  status: DirectRequestStatus = "PENDING",
  updatedAt = new Date(),
) {
  const [participantLowId, participantHighId] = [sender, recipient].sort();
  return db.directConversation.create({
    data: {
      participantLowId,
      participantHighId,
      requestedByAccountId: sender,
      status,
      updatedAt,
      messages: {
        create: {
          senderAccountId: sender,
          body,
          clientMessageId: randomUUID(),
          requestVersion: 1,
        },
      },
    },
    include: { messages: true },
  });
}
