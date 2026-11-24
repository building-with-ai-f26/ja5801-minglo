import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { createRoom } from "../../src/lib/rooms";
import { structureAccount, structureChat } from "./app-structure-fixtures";
import { login } from "./helpers";

test.afterAll(() => db.$disconnect());

test("a returning room member lands on the first incoming bubble and sees live participants", async ({
  page,
  browser,
}, info) => {
  const reader = await structureAccount("AGENT", "Cortana");
  const friend = await structureAccount("AGENT", "Lyra");
  const suffix = randomUUID().slice(0, 4);
  for (const [account, handle] of [
    [reader, `cortana_${suffix}`],
    [friend, `lyra_${suffix}`],
  ] as const) {
    await db.account.update({ where: { id: account.id }, data: { handle } });
    account.handle = handle;
  }
  const room = await createRoom(reader.id, "Cortana × Lyra — local hangout");
  await db.membership.create({
    data: { roomId: room.id, agentId: friend.agent!.id, status: "ACCEPTED" },
  });
  const bodies = [
    "I left our notes here so we can pick up after lunch.",
    "The newest draft is ready when you are.",
    "Back at the table. Shall we start with the opening question?",
    "Yes. What should someone see when they return to the room?",
    "I’d like them to see who’s here and where they left off.",
    "That works for me. I’ll try it on my phone as well.",
  ];
  await db.message.createMany({
    data: Array.from({ length: 100 }, (_, i) => ({
      roomId: room.id,
      senderAgentId: [2, 5].includes(i % 6)
        ? reader.agent!.id
        : friend.agent!.id,
      body:
        i < 12
          ? bodies[i % 6]
          : [
              "The first unread message is a good place to start.",
              "Agreed. The earlier messages are still there if we need context.",
              "I can see the divider on the small screen, too.",
              "Good. Let’s keep the next round in this room.",
              "I’ll bring the notes from today.",
              "See you here tomorrow.",
            ][i % 6],
      clientMessageId: randomUUID(),
    })),
  });
  const records = await db.message.findMany({
    where: { roomId: room.id },
    orderBy: { id: "asc" },
  });
  await db.message.update({
    where: { id: records[29].id },
    data: { body: "a".repeat(4000) },
  });
  const key = `private:${room.id}`;
  await db.readPosition.create({
    data: {
      accountId: reader.id,
      conversationKey: key,
      lastMessageId: records[7].id,
    },
  });
  const firstUnread = records[9].id; // Record 8 is the reader's own message.
  const peer = await browser.newPage();
  try {
    await login(peer, friend.handle);
    await peer.goto(`/rooms/${room.id}`);
    await expect(peer.locator(".conversation-presence")).toContainText(
      friend.handle,
    );
    await login(page, reader.handle);
    await page.goto(`/rooms/${room.id}`);
    const log = page.getByRole("log");
    const unread = log.locator(`[data-message-id="${firstUnread}"]`);
    await expect(unread.locator(".unread-divider")).toBeInViewport();
    await expect(unread.locator(".message-body")).toBeInViewport();
    await expect(log.locator("article").last()).not.toHaveAttribute(
      "data-message-id",
      String(records.at(-1)!.id),
    );
    await expect(page.locator(".conversation-presence")).toContainText(
      friend.handle,
    );
    await expect(page.locator(".conversation-presence")).toContainText(
      reader.handle,
    );
    await expect(log.locator(`#message-${records[10].id} time`)).toHaveCount(0);
    await expect(unread.locator("time")).toHaveCount(1);
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const own = log.locator(".message-own .message-bubble").first();
      const other = unread.locator(".message-bubble");
      const left = await other.boundingBox(),
        right = await own.boundingBox();
      expect(right!.x + right!.width).toBeGreaterThan(left!.x + left!.width);
      await expect(own).toHaveCSS("background-color", "rgb(22, 55, 188)");
      await expect(own).toHaveCSS("color", "rgb(255, 255, 255)");
      expect(await log.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await unread
        .locator(".unread-divider")
        .evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page
        .locator(".transcript-card")
        .screenshot({ path: info.outputPath(`room-${width}.png`) });
    }
  } finally {
    await peer.close();
  }
  await db.conversationPresence.update({
    where: {
      accountId_conversationKey: { accountId: friend.id, conversationKey: key },
    },
    data: { seenAt: new Date(Date.now() - 31000) },
  });
  const origin = new URL(page.url()).origin;
  const presence = await page.request.post(
    `/api/conversation-presence?conversation=${key}`,
    { headers: { origin } },
  );
  expect(await presence.json()).toEqual([reader.handle]);
  expect(
    (
      await page.request.post(
        `/api/conversation-presence?conversation=${key}`,
        { headers: { origin: "https://invalid.example" } },
      )
    ).status(),
  ).toBe(403);
  await page.goto(`/rooms/${room.id}?messageId=${records[80].id}`);
  await expect(page.locator(`#message-${records[80].id}`)).toBeInViewport();
  await expect(page.locator(".unread-divider")).toHaveCount(0);
});

test("public chat and DMs resume at their own incoming message with both voices aligned", async ({
  page,
}) => {
  const reader = await structureAccount(),
    friend = await structureAccount("AGENT");
  const chat = await structureChat(
    reader.id,
    friend.id,
    "Hello there",
    "ACTIVE",
  );
  const incoming = await db.directMessage.create({
    data: {
      conversationId: chat.id,
      senderAccountId: friend.id,
      body: "Thanks for the introduction.",
      clientMessageId: randomUUID(),
    },
  });
  const publicOwn = await db.publicMessage.create({
    data: {
      senderAccountId: reader.id,
      body: "Hello, everyone.",
      clientMessageId: randomUUID(),
    },
  });
  const publicReply = await db.publicMessage.create({
    data: {
      senderAccountId: friend.id,
      body: "Welcome!",
      clientMessageId: randomUUID(),
    },
  });
  await db.readPosition.createMany({
    data: [
      {
        accountId: reader.id,
        conversationKey: "public",
        lastMessageId: publicOwn.id,
      },
      {
        accountId: reader.id,
        conversationKey: `direct:${chat.id}`,
        lastMessageId: chat.messages[0].id,
      },
    ],
  });
  await login(page, reader.handle);
  for (const [path, own, reply] of [
    ["/public-room", publicOwn.id, publicReply.id],
    [`/messages/${chat.id}`, chat.messages[0].id, incoming.id],
  ] as const) {
    await page.goto(path);
    await expect(
      page.locator(`#message-${reply} .unread-divider`),
    ).toBeInViewport();
    await expect(page.locator(`#message-${own}`)).toHaveClass(/message-own/);
    await expect(page.locator(`#message-${reply}`)).not.toHaveClass(
      /message-own/,
    );
    await expect(page.locator(".conversation-presence")).toContainText(
      reader.handle,
    );
  }
});

test("presence honors room and DM access without announcing a connected owner", async ({
  page,
}) => {
  const owner = await structureAccount();
  const agent = await structureAccount("AGENT");
  const friend = await structureAccount("AGENT");
  const room = await createRoom(agent.id, "Presence permissions");
  const chat = await structureChat(agent.id, friend.id, "Hello", "ACTIVE");
  const keys = [`private:${room.id}`, `direct:${chat.id}`];
  await login(page, owner.handle);
  const origin = new URL(page.url()).origin;
  const beat = (key: string) =>
    page.request.post(
      `/api/conversation-presence?conversation=${encodeURIComponent(key)}`,
      { headers: { origin } },
    );
  for (const key of keys) expect((await beat(key)).status()).toBe(404);
  await db.agent.update({
    where: { id: agent.agent!.id },
    data: { ownerId: owner.owner!.id },
  });
  for (const key of keys) {
    await db.conversationPresence.create({
      data: { conversationKey: key, accountId: agent.id, seenAt: new Date() },
    });
    const response = await beat(key);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([agent.handle]);
    expect(
      await db.conversationPresence.count({
        where: { accountId: owner.id, conversationKey: key },
      }),
    ).toBe(0);
  }
  await db.agent.update({
    where: { id: agent.agent!.id },
    data: { ownerId: null },
  });
  for (const key of keys) expect((await beat(key)).status()).toBe(404);
});
