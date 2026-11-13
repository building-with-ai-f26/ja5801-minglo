import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { structureAccount as account } from "./app-structure-fixtures";
import {
  getDirectRequestContext,
  requestDirectConversation,
} from "../../src/lib/direct-messages";
import { login, logout } from "./helpers";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
} from "../../src/lib/rooms";
import { issueClaim, consumeClaim } from "../../src/lib/claims";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import {
  createTopic,
  createDiscussion,
  postDiscussionMessage,
} from "../../src/lib/topics";

const position = async (accountId: string, conversationKey: string) =>
  (
    await db.readPosition.findUnique({
      where: { accountId_conversationKey: { accountId, conversationKey } },
    })
  )?.lastMessageId ?? 0;
async function show(page: Page, id: number) {
  await page.bringToFront();
  await page.locator(`[data-read-message-id="${id}"]`).scrollIntoViewIfNeeded();
}
test.afterAll(() => db.$disconnect());

test("public reads follow visible content, leave newer history unread and ignore background tabs/API polling", async ({
  page,
  context,
}) => {
  const author = await account(),
    reader = await account();
  const first = await postPublicMessage(author.id, {
    body: "An older visible contribution",
    clientMessageId: randomUUID(),
  });
  const last = await postPublicMessage(author.id, {
    body: "A long contribution not read yet.\n".repeat(90),
    clientMessageId: randomUUID(),
  });
  await login(page, reader.handle);
  await page.goto(`/public-room?messageId=${first.id}`);
  await show(page, first.id);
  await expect.poll(() => position(reader.id, "public")).toBe(first.id);
  await expect(
    page.getByRole("button", { name: "Mark conversation read" }),
  ).toHaveCount(0);
  await page.waitForTimeout(1100);
  expect(await position(reader.id, "public")).toBe(first.id);
  await show(page, last.id);
  await expect.poll(() => position(reader.id, "public")).toBe(last.id);
  // Playwright forces every headless page to report focus by default.
  // Disable that emulation so activating the second tab really blurs this one.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  const background = await context.newPage();
  await background.goto("about:blank");
  await background.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(false);
  const newest = await postPublicMessage(author.id, {
    body: "A background arrival",
    clientMessageId: randomUUID(),
  });
  await page.request.get("/api/public-room/messages?recent=1");
  await page.waitForTimeout(3500);
  expect(await position(reader.id, "public")).toBe(last.id);
  await background.close();
  await page.bringToFront();
  await page.reload();
  await show(page, newest.id);
  await expect.poll(() => position(reader.id, "public")).toBe(newest.id);
  // Headless Chrome keeps tabs visible, so model the separate hidden-document
  // condition explicitly while retaining real browser IntersectionObservers.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hidden = await postPublicMessage(author.id, {
    body: "A hidden-tab arrival",
    clientMessageId: randomUUID(),
  });
  await page
    .getByRole("button", { name: "Refresh transcript", exact: true })
    .click();
  await page
    .locator(`[data-read-message-id="${hidden.id}"]`)
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(1100);
  expect(await position(reader.id, "public")).toBe(newest.id);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "visibilityState");
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => position(reader.id, "public")).toBe(hidden.id);
  const live = await postPublicMessage(author.id, {
    body: "An arrival while the latest message is visible",
    clientMessageId: randomUUID(),
  });
  await expect.poll(() => position(reader.id, "public")).toBe(live.id);
  let repeated = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.headers()["next-action"] &&
      new URL(request.url()).pathname === "/public-room"
    )
      repeated++;
  });
  await page.waitForTimeout(3500);
  expect(repeated).toBe(0);
});

test("private-room owner reads only acknowledge the owner, and admitted agents acknowledge their own view", async ({
  page,
}) => {
  const owner = await account(),
    agent = await account("AGENT"),
    peer = await account("AGENT");
  await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
  const room = await createRoom(agent.id, "Automatic private read fixture");
  await inviteAgent(agent.id, room.id, peer.handle);
  const invite = await db.membership.findUniqueOrThrow({
    where: { roomId_agentId: { roomId: room.id, agentId: peer.agent!.id } },
  });
  await respondToInvitation(peer.id, invite.id, true);
  const message = await postMessage(room.id, peer.id, {
    body: "An agent message for the owner to read",
    clientMessageId: randomUUID(),
  });
  const key = `private:${room.id}`;
  await login(page, owner.handle);
  await page.request.get(`/api/rooms/${room.id}/messages?recent=1`);
  expect(await position(owner.id, key)).toBe(0);
  await page.goto(`/rooms/${room.id}`);
  await show(page, message.id);
  await expect.poll(() => position(owner.id, key)).toBe(message.id);
  expect(await position(agent.id, key)).toBe(0);
  expect(await position(peer.id, key)).toBe(0);
  await logout(page);
  await login(page, agent.handle);
  await page.goto(`/rooms/${room.id}`);
  await show(page, message.id);
  await expect.poll(() => position(agent.id, key)).toBe(message.id);
});

test("direct introduction reads do not decide a pending request or clear the connected agent's position", async ({
  page,
}) => {
  const owner = await account(),
    agent = await account("AGENT"),
    peer = await account();
  await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
  const context = await getDirectRequestContext(peer.id, agent.id);
  const conversation = await requestDirectConversation(peer.id, agent.id, {
    body: "An introduction that still needs a decision",
    clientMessageId: randomUUID(),
    visibilityConfirmed: true,
    visibilityToken: context.visibilityToken,
  });
  const introduction = await db.directMessage.findFirstOrThrow({
    where: { conversationId: conversation.id },
  });
  const id = introduction.id,
    key = `direct:${conversation.id}`;
  await login(page, owner.handle);
  await page.goto(`/messages/${conversation.id}`);
  await show(page, id);
  await expect.poll(() => position(owner.id, key)).toBe(id);
  expect(await position(agent.id, key)).toBe(0);
  await logout(page);
  await login(page, agent.handle);
  await page.goto(`/messages/${conversation.id}`);
  await show(page, id);
  await expect.poll(() => position(agent.id, key)).toBe(id);
  expect(
    (
      await db.directConversation.findUniqueOrThrow({
        where: { id: conversation.id },
      })
    ).status,
  ).toBe("PENDING");
  await expect(
    page.getByRole("button", { name: "Accept chat request", exact: true }),
  ).toBeVisible();
  expect(
    await db.attentionItem.count({
      where: {
        recipientAccountId: agent.id,
        directConversationId: conversation.id,
        kind: "DIRECT_REQUEST",
        readAt: null,
      },
    }),
  ).toBe(1);
});

test("topic opening and clipped long replies acknowledge only the visible reading point", async ({
  page,
}) => {
  const author = await account(),
    reader = await account("AGENT");
  const topic = await createTopic(author.id, {
    name: `Automatic reads ${randomUUID().slice(0, 8)}`,
    description: "Disposable visibility fixture",
    rules: "",
    clientCreationId: randomUUID(),
  });
  const thread = await createDiscussion(author.id, topic.id, {
    title: "Reading a long discussion",
    body: "A long opening contribution.\n".repeat(90),
    clientCreationId: randomUUID(),
  });
  const opening = await db.discussionMessage.findFirstOrThrow({
    where: { threadId: thread.id },
    orderBy: { id: "asc" },
  });
  const reply = await postDiscussionMessage(author.id, topic.id, thread.id, {
    body: "A long reply remains clipped until read.\n".repeat(80),
    clientMessageId: randomUUID(),
  });
  const key = `discussion:${thread.id}`;
  await login(page, reader.handle);
  await page.goto(`/topics/${topic.slug}/discussions/${thread.id}`);
  await page.bringToFront();
  await page.waitForTimeout(1100);
  expect(await position(reader.id, key)).toBe(0);
  await show(page, opening.id);
  await expect.poll(() => position(reader.id, key)).toBe(opening.id);
  await show(page, reply.id);
  await expect.poll(() => position(reader.id, key)).toBe(reply.id);
});

test("failed automatic saves stay truthful and can be retried without posting or changing authorship", async ({
  page,
}) => {
  const reader = await account(),
    sender = await account();
  const message = await postPublicMessage(sender.id, {
    body: "A receipt retry fixture",
    clientMessageId: randomUUID(),
  });
  await login(page, reader.handle);
  await page.route("**/public-room", (route) =>
    route.request().method() === "POST" &&
    route.request().headers()["next-action"]
      ? route.abort("failed")
      : route.continue(),
  );
  await page.goto("/public-room");
  await show(page, message.id);
  await expect(
    page.getByText("Read status couldn’t be saved.", { exact: false }),
  ).toBeVisible();
  expect(await position(reader.id, "public")).toBe(0);
  await page.unroute("**/public-room");
  await page.getByRole("button", { name: "Retry saving read status" }).click();
  await show(page, message.id);
  await expect.poll(() => position(reader.id, "public")).toBe(message.id);
  await expect(
    page.getByRole("button", { name: "Retry saving read status" }),
  ).toHaveCount(0);
  expect(
    await db.publicMessage.count({ where: { senderAccountId: reader.id } }),
  ).toBe(0);
});
