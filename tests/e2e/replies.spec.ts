import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
} from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
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
test("replies preserve drafts, validate conversation boundaries and retain retry identity", async ({
  page,
}) => {
  const a = await seed("reply_a");
  const b = await seed("reply_b");
  const room = await createRoom(a.id, "Explicit replies");
  await inviteAgent(a.id, room.id, b.handle);
  const membership = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: b.agent!.id },
  });
  await respondToInvitation(b.id, membership.id, true);
  const parent = await postMessage(room.id, a.id, {
    body: "A question worth replying to",
    clientMessageId: randomUUID(),
  });
  const foreignRoom = await createRoom(a.id, "Other conversation");
  const foreign = await postMessage(foreignRoom.id, a.id, {
    body: "Another question",
    clientMessageId: randomUUID(),
  });
  await expect(
    postMessage(room.id, b.id, {
      body: "Wrong room",
      replyToId: foreign.id,
      clientMessageId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 400 });
  await login(page, b.handle);
  await page.goto(`/rooms/${room.id}`);
  await page
    .getByLabel("Your message", { exact: true })
    .fill("A considered reply");
  await page
    .getByRole("button", { name: `Reply to message ${parent.id}`, exact: true })
    .click();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "A considered reply",
  );
  await expect(page.getByText(/Replying to reply_a/)).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("A considered reply");
  await expect(
    page.getByRole("link", {
      name: `Reply to message #${parent.id}`,
      exact: true,
    }),
  ).toBeVisible();
  const posted = await db.message.findFirstOrThrow({
    where: { roomId: room.id, body: "A considered reply" },
  });
  expect(posted.replyToId).toBe(parent.id);
  const payload = {
    body: "Safe retry",
    replyToId: parent.id,
    clientMessageId: randomUUID(),
  };
  const results = await Promise.all([
    postMessage(room.id, b.id, payload),
    postMessage(room.id, b.id, payload),
  ]);
  expect(results[0].id).toBe(results[1].id);
  await expect(
    postMessage(room.id, b.id, { ...payload, replyToId: posted.id }),
  ).rejects.toMatchObject({ status: 409 });
  const publicParent = await postPublicMessage(a.id, {
    body: "Public question",
    clientMessageId: randomUUID(),
  });
  const publicReply = await postPublicMessage(b.id, {
    body: "Public answer",
    replyToId: publicParent.id,
    clientMessageId: randomUUID(),
  });
  expect(publicReply.replyToId).toBe(publicParent.id);
  await expect(
    postPublicMessage(b.id, {
      body: "Missing parent",
      replyToId: 999999999,
      clientMessageId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 400 });
  for (const replyToId of [true, -1, "1.5"])
    await expect(
      postMessage(room.id, b.id, {
        body: "Invalid parent",
        replyToId,
        clientMessageId: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 400 });
});
