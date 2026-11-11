import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { getInbox, markConversationRead } from "../../src/lib/inbox";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
} from "../../src/lib/rooms";
import { removeParticipant } from "../../src/lib/room-controls";
import { issueClaim, consumeClaim } from "../../src/lib/claims";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import { login, password } from "./helpers";

async function seed(label: string, type: "AGENT" | "OWNER" = "AGENT") {
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

test("read positions are explicit, monotonic, account-scoped and permission checked", async ({
  page,
}) => {
  const a = await seed("inbox_a");
  const b = await seed("inbox_b");
  const owner = await seed("inbox_owner", "OWNER");
  const outsider = await seed("inbox_other");
  const room = await createRoom(a.id, "Unread discussion");
  await inviteAgent(a.id, room.id, b.handle);
  const membership = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: b.agent!.id },
  });
  await respondToInvitation(b.id, membership.id, true);
  await consumeClaim(owner.id, (await issueClaim(b.id)).token);
  const first = await postMessage(room.id, a.id, {
    body: "A useful first thought",
    clientMessageId: randomUUID(),
  });
  await postMessage(room.id, a.id, {
    body: "A second thought",
    clientMessageId: randomUUID(),
  });
  const own = await postMessage(room.id, b.id, {
    body: "My own contribution",
    clientMessageId: randomUUID(),
  });
  const key = `private:${room.id}`;
  expect((await getInbox(b.id)).find((i) => i.key === key)?.unread).toBe(2);
  expect((await getInbox(owner.id)).find((i) => i.key === key)?.unread).toBe(3);
  expect(
    (await getInbox(outsider.id)).find((i) => i.key === key),
  ).toBeUndefined();
  await markConversationRead(owner.id, key, own.id);
  expect((await getInbox(b.id)).find((i) => i.key === key)?.unread).toBe(2);
  await login(page, b.handle);
  await page.goto(`/rooms/${room.id}`);
  await page.request.get(`/api/rooms/${room.id}/messages?after=0`);
  expect(await db.readPosition.count({ where: { accountId: b.id } })).toBe(0);
  await page.getByRole("button", { name: "Mark conversation read" }).click();
  await expect
    .poll(async () => (await getInbox(b.id)).some((i) => i.key === key))
    .toBe(false);
  await markConversationRead(b.id, key, first.id);
  expect(
    (
      await db.readPosition.findUniqueOrThrow({
        where: {
          accountId_conversationKey: { accountId: b.id, conversationKey: key },
        },
      })
    ).lastMessageId,
  ).toBe(own.id);
  await page.goto("/inbox");
  await expect(
    page.getByRole("heading", { name: "Messages", level: 1, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Unread conversations" }),
  ).not.toContainText("Unread discussion");
  const foreign = await createRoom(outsider.id, "Foreign room");
  const foreignMessage = await postMessage(foreign.id, outsider.id, {
    body: "Secret",
    clientMessageId: randomUUID(),
  });
  await expect(
    markConversationRead(b.id, key, foreignMessage.id),
  ).rejects.toThrow("unavailable");
  await expect(
    markConversationRead(outsider.id, key, first.id),
  ).rejects.toThrow("unavailable");
  const previousPublic = await db.publicMessage.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (previousPublic)
    await markConversationRead(b.id, "public", previousPublic.id);
  const publicOwn = await postPublicMessage(b.id, {
    body: "Only my public message",
    clientMessageId: randomUUID(),
  });
  expect(
    (await getInbox(b.id)).find((i) => i.key === "public"),
  ).toBeUndefined();
  const publicOther = await postPublicMessage(a.id, {
    body: "Public update",
    clientMessageId: randomUUID(),
  });
  expect((await getInbox(b.id)).find((i) => i.key === "public")?.unread).toBe(
    1,
  );
  await markConversationRead(b.id, "public", publicOther.id);
  await markConversationRead(b.id, "public", publicOwn.id);
  expect(
    (await getInbox(b.id)).find((i) => i.key === "public"),
  ).toBeUndefined();
  await removeParticipant(a.id, room.id, b.agent!.id);
  await expect(markConversationRead(b.id, key, own.id)).rejects.toThrow(
    "unavailable",
  );
  expect((await getInbox(b.id)).find((i) => i.key === key)).toBeUndefined();
});
