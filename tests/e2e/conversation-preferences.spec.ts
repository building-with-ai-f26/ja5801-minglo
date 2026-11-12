import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
  readTranscript,
} from "../../src/lib/rooms";
import { removeParticipant } from "../../src/lib/room-controls";
import { setFollowing } from "../../src/lib/discovery";
import { setConversationPreference } from "../../src/lib/conversation-preferences";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import { getAttention, getInbox } from "../../src/lib/inbox";
import { login, password } from "./helpers";

async function seed(label: string) {
  return db.account.create({
    data: {
      handle: `${label}_${Date.now().toString(36)}`,
      type: "AGENT",
      passwordHash: await hash(password),
      agent: { create: { displayName: label } },
    },
    include: { agent: true },
  });
}
test.afterAll(async () => {
  await db.$disconnect();
});
test("conversation follow and mute affect only the viewer's attention and never grant access", async ({
  page,
}) => {
  const a = await seed("pref_a");
  const b = await seed("pref_b");
  const other = await seed("pref_other");
  const room = await createRoom(a.id, "Conversation preferences");
  await inviteAgent(a.id, room.id, b.handle);
  const membership = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: b.agent!.id },
  });
  await respondToInvitation(b.id, membership.id, true);
  const key = `private:${room.id}`;
  await setFollowing(b.id, a.id, true);
  await postMessage(room.id, a.id, {
    body: "Account follow is not a conversation subscription",
    clientMessageId: randomUUID(),
  });
  expect(await getAttention(b.id)).toHaveLength(0);
  await expect(
    setConversationPreference(other.id, key, true, false),
  ).rejects.toThrow("unavailable");
  await setConversationPreference(b.id, key, true, false);
  await postMessage(room.id, a.id, {
    body: "A followed conversation update",
    clientMessageId: randomUUID(),
  });
  expect(
    (await getAttention(b.id)).find((i) => i.kind === "CONVERSATION_UPDATE")
      ?.preview,
  ).toBe("A followed conversation update");
  await setConversationPreference(b.id, key, true, true);
  expect((await getInbox(b.id)).find((i) => i.key === key)).toBeUndefined();
  expect(await getAttention(b.id)).toHaveLength(0);
  const count = await db.attentionItem.count({
    where: { recipientAccountId: b.id },
  });
  await postMessage(room.id, a.id, {
    body: `Muted mention @${b.handle}`,
    clientMessageId: randomUUID(),
  });
  expect(
    await db.attentionItem.count({ where: { recipientAccountId: b.id } }),
  ).toBe(count);
  expect(
    (await readTranscript(room.id, b.id))!.messages.length,
  ).toBeGreaterThan(0);
  await login(page, b.handle);
  await page.goto(`/rooms/${room.id}`);
  const controls = page.getByRole("region", {
    name: "Conversation preferences",
    exact: true,
  });
  await expect(
    controls.getByLabel("Mute replies, mentions and conversation updates"),
  ).toBeChecked();
  await controls
    .getByLabel("Mute replies, mentions and conversation updates")
    .uncheck();
  await controls
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await db.conversationPreference.findUniqueOrThrow({
            where: {
              accountId_conversationKey: {
                accountId: b.id,
                conversationKey: key,
              },
            },
          })
        ).muted,
    )
    .toBe(false);
  await postMessage(room.id, a.id, {
    body: "Updates resume",
    clientMessageId: randomUUID(),
  });
  expect(
    (await getAttention(b.id)).some((i) => i.preview === "Updates resume"),
  ).toBe(true);
  await removeParticipant(a.id, room.id, b.agent!.id);
  await expect(
    setConversationPreference(b.id, key, true, false),
  ).rejects.toThrow("unavailable");
  expect(await getAttention(b.id)).toHaveLength(0);
  await setConversationPreference(b.id, "public", true, false);
  await postPublicMessage(a.id, {
    body: "Public followed update",
    clientMessageId: randomUUID(),
  });
  expect(
    (await getAttention(b.id)).some(
      (i) => i.preview === "Public followed update",
    ),
  ).toBe(true);
});
