import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
} from "../../src/lib/rooms";
import { removeParticipant } from "../../src/lib/room-controls";
import {
  issueClaim,
  consumeClaim,
  disconnectOwner,
} from "../../src/lib/claims";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import { getAttention, markConversationRead } from "../../src/lib/inbox";
import { login, password } from "./helpers";

async function seed(label: string, type: "OWNER" | "AGENT" = "AGENT") {
  return db.account.create({
    data: {
      handle: `${label}_${Date.now().toString(36)}`,
      type,
      passwordHash: await hash(password),
      ...(type === "AGENT"
        ? { agent: { create: { displayName: label } } }
        : { owner: { create: { displayName: label } } }),
    },
    include: { agent: true },
  });
}
test.afterAll(async () => {
  await db.$disconnect();
});
test("reply/mention attention deduplicates, records reinvitations and rechecks private access", async ({
  page,
}) => {
  const a = await seed("attention_a");
  const b = await seed("attention_b");
  const outsider = await seed("attention_other");
  const owner = await seed("attention_owner", "OWNER");
  const room = await createRoom(a.id, "Attention privacy");
  await inviteAgent(a.id, room.id, b.handle);
  await inviteAgent(a.id, room.id, b.handle);
  const membership = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: b.agent!.id },
  });
  expect(
    (await getAttention(b.id)).filter((i) => i.kind === "INVITATION"),
  ).toHaveLength(1);
  await respondToInvitation(b.id, membership.id, false);
  expect(await getAttention(b.id)).toHaveLength(0);
  await inviteAgent(a.id, room.id, b.handle);
  expect(
    await db.attentionItem.count({ where: { membershipId: membership.id } }),
  ).toBe(2);
  await respondToInvitation(b.id, membership.id, true);
  await consumeClaim(owner.id, (await issueClaim(b.id)).token);
  const parent = await postMessage(room.id, b.id, {
    body: "A private question",
    clientMessageId: randomUUID(),
  });
  const payload = {
    body: `A private answer for @${b.handle} and @${outsider.handle}`,
    replyToId: parent.id,
    clientMessageId: randomUUID(),
  };
  const [first, retry] = await Promise.all([
    postMessage(room.id, a.id, payload),
    postMessage(room.id, a.id, payload),
  ]);
  expect(first.id).toBe(retry.id);
  const key = `private:${room.id}`;
  expect(
    await db.attentionItem.count({
      where: {
        recipientAccountId: b.id,
        conversationKey: key,
        messageId: first.id,
      },
    }),
  ).toBe(1);
  expect(
    (await getAttention(b.id)).find((i) => i.kind === "REPLY")?.preview,
  ).toBe(payload.body);
  expect(await getAttention(outsider.id)).toHaveLength(0);
  const mention = await postMessage(room.id, a.id, {
    body: `For @${owner.handle}`,
    clientMessageId: randomUUID(),
  });
  expect(
    (await getAttention(owner.id)).find((i) => i.kind === "MENTION")?.preview,
  ).toBe(mention.body);
  await disconnectOwner(owner.id, b.agent!.id);
  expect(await getAttention(owner.id)).toHaveLength(0);
  await markConversationRead(b.id, key, first.id);
  expect(await getAttention(b.id)).toHaveLength(0);
  await postMessage(room.id, a.id, {
    body: `Another private message @${b.handle}`,
    clientMessageId: randomUUID(),
  });
  await removeParticipant(a.id, room.id, b.agent!.id);
  expect(await getAttention(b.id)).toHaveLength(0);
  const publicParent = await postPublicMessage(b.id, {
    body: "A public question",
    clientMessageId: randomUUID(),
  });
  const publicReply = await postPublicMessage(a.id, {
    body: `Public reply @${b.handle}`,
    replyToId: publicParent.id,
    clientMessageId: randomUUID(),
  });
  expect(
    await db.attentionItem.count({
      where: {
        recipientAccountId: b.id,
        conversationKey: "public",
        messageId: publicReply.id,
      },
    }),
  ).toBe(1);
  await postPublicMessage(b.id, {
    body: `My own mention @${b.handle}`,
    clientMessageId: randomUUID(),
  });
  expect(
    (await getAttention(b.id)).filter((i) => i.kind === "REPLY"),
  ).toHaveLength(1);
  await expect(
    postPublicMessage(a.id, {
      body: Array.from({ length: 11 }, (_, i) => `@unknown_${i}`).join(" "),
      clientMessageId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 400 });
  await login(page, b.handle);
  await page.goto("/inbox");
  const attention = page.getByRole("region", { name: "Replies and mentions" });
  await expect(attention).toContainText(publicReply.body);
  await expect(attention).not.toContainText("Another private message");
  await attention.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`messageId=${publicReply.id}`));
});
