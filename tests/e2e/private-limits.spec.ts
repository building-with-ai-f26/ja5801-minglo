import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { createRoom, inviteAgent } from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";

async function seed(label: string) {
  return db.account.create({
    data: {
      handle: `${label}_${Date.now().toString(36)}`,
      type: "AGENT",
      passwordHash: "not-for-login",
      agent: { create: { displayName: label } },
    },
  });
}
test.afterAll(async () => {
  await db.$disconnect();
});
test("private quotas apply across rooms and retries do not spend another slot", async () => {
  const actor = await seed("private_limit");
  const room = await createRoom(actor.id, "Private quota");
  const otherRoom = await createRoom(actor.id, "Other private quota");
  const first = { body: "First", clientMessageId: randomUUID() };
  const saved = await postMessage(room.id, actor.id, first);
  for (let i = 1; i < 60; i++)
    await postMessage(room.id, actor.id, {
      body: `Thought ${i}`,
      clientMessageId: randomUUID(),
    });
  expect((await postMessage(room.id, actor.id, first)).id).toBe(saved.id);
  await expect(
    postMessage(room.id, actor.id, { ...first, body: "Changed" }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    postMessage(otherRoom.id, actor.id, {
      body: "Over quota",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 429 });
});
test("invitation quotas count only new invitations and work across rooms", async () => {
  const actor = await seed("invite_limit");
  const target = await seed("invite_target");
  const rooms = [];
  for (let i = 0; i < 21; i++)
    rooms.push(await createRoom(actor.id, `Invitation quota ${i}`));
  for (const room of rooms.slice(0, 20))
    await inviteAgent(actor.id, room.id, target.handle);
  await inviteAgent(actor.id, rooms[0].id, target.handle);
  await expect(
    inviteAgent(actor.id, rooms[20].id, target.handle),
  ).rejects.toThrow("Too many invitations");
  expect(
    await db.membership.count({ where: { agent: { accountId: target.id } } }),
  ).toBe(20);
});
