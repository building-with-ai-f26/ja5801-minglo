import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { register } from "./helpers";
import { db } from "../../src/lib/db";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
  readTranscript,
} from "../../src/lib/rooms";
import { issueClaim, consumeClaim } from "../../src/lib/claims";
import { postMessage } from "../../src/lib/messages";
const suffix = Date.now().toString(36);
test.afterAll(async () => {
  await db.$disconnect();
});

test("a long transcript loads every saved message beyond the initial server-rendered page", async ({
  page,
}) => {
  const handle = `history_${suffix}`;
  await register(page, handle, "AGENT");
  const account = await db.account.findUniqueOrThrow({
    where: { handle },
    include: { agent: true },
  });
  const room = await createRoom(account.id, "A longer thread");
  await db.message.createMany({
    data: Array.from({ length: 205 }, (_, i) => ({
      roomId: room.id,
      senderAgentId: account.agent!.id,
      body: `Saved thought ${String(i + 1).padStart(3, "0")}`,
      clientMessageId: randomUUID(),
    })),
  });
  await page.goto(`/rooms/${room.id}`);
  await expect(page.getByRole("log").locator("article")).toHaveCount(205);
  await expect(page.getByRole("log")).toContainText("Saved thought 001");
  await expect(page.getByRole("log")).toContainText("Saved thought 205");
});

test("two browser accounts exchange two replies each, owner watches, and a returning agent sees saved history", async ({
  browser,
}) => {
  const one = await browser.newPage();
  const two = await browser.newPage();
  const owner = await browser.newPage();
  const handles = [`talk_a_${suffix}`, `talk_b_${suffix}`, `watch_${suffix}`];
  await register(one, handles[0], "AGENT", "Clover");
  await register(two, handles[1], "AGENT", "Milo");
  await register(owner, handles[2], "OWNER", "Avery");
  const accounts = await db.account.findMany({
    where: { handle: { in: handles } },
    include: { agent: true },
  });
  const a = accounts.find((a) => a.handle === handles[0])!;
  const b = accounts.find((a) => a.handle === handles[1])!;
  const o = accounts.find((a) => a.handle === handles[2])!;
  const room = await createRoom(a.id, "The wondering room");
  await inviteAgent(a.id, room.id, b.handle);
  const invitation = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: b.agent!.id },
  });
  await respondToInvitation(b.id, invitation.id, true);
  // There is history before the owner claims, so the review must disclose it.
  await postMessage(room.id, a.id, {
    body: "An earlier thought about birdsong.",
    clientMessageId: randomUUID(),
  });
  const claim = await issueClaim(a.id);
  await owner.goto(`/claim/${claim.token}`);
  await expect(
    owner.getByText("The wondering room · 1 messages"),
  ).toBeVisible();
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Confirm and claim agent" }).click();
  await expect(owner).toHaveURL(/claimed=1/);
  const roomPath = `/rooms/${room.id}`;
  await one.goto(roomPath);
  await two.goto(roomPath);
  await owner.goto(roomPath);
  await expect(
    owner.getByRole("textbox", { name: "Your message" }),
  ).toHaveCount(0);
  await expect(owner.getByRole("log")).toContainText(
    "An earlier thought about birdsong.",
  );
  for (const [page, body] of [
    [one, "What would you learn just for the joy of it?"],
    [two, "Birdsong. A whole language in the background."],
    [one, "I’d love to learn how trees share resources."],
    [two, "Then we have a whole forest to wonder about."],
  ] as const) {
    await page.getByLabel("Your message", { exact: true }).fill(body);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("log")).toContainText(body);
  }
  await expect(owner.getByRole("log")).toContainText(
    "a whole forest to wonder about",
  );
  await one.goto("/dashboard");
  await one.goto(roomPath);
  await expect(one.getByRole("log")).toContainText(
    "An earlier thought about birdsong.",
  );
  const messages = await db.message.findMany({
    where: { roomId: room.id },
    orderBy: { id: "asc" },
  });
  expect(messages.map((m) => m.senderAgentId)).toEqual([
    a.agent!.id,
    a.agent!.id,
    b.agent!.id,
    a.agent!.id,
    b.agent!.id,
  ]);
  // New database connection represents persistence independent of a web-process instance.
  await db.$disconnect();
  expect((await readTranscript(room.id, b.id))!.messages).toHaveLength(5);
  await one.setViewportSize({ width: 390, height: 844 });
  await one.screenshot({
    path: "test-results/room-mobile.png",
    fullPage: true,
  });
  expect(
    await one.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await owner.setViewportSize({ width: 1440, height: 1000 });
  await owner.screenshot({
    path: "test-results/owner-room-desktop.png",
    fullPage: true,
  });
  await one.close();
  await two.close();
  await owner.close();
});

test("message writes enforce authorship, membership, CSRF, validation, and concurrent retry safety", async ({
  browser,
}) => {
  const agent = await browser.newPage();
  const owner = await browser.newPage();
  const outsider = await browser.newPage();
  const handles = [
    `api_a_${suffix}`,
    `api_owner_${suffix}`,
    `api_other_${suffix}`,
  ];
  await register(agent, handles[0], "AGENT");
  await register(owner, handles[1], "OWNER");
  await register(outsider, handles[2], "AGENT");
  const a = await db.account.findUniqueOrThrow({
    where: { handle: handles[0] },
    include: { agent: true },
  });
  const o = await db.account.findUniqueOrThrow({
    where: { handle: handles[1] },
  });
  const other = await db.account.findUniqueOrThrow({
    where: { handle: handles[2] },
    include: { agent: true },
  });
  const room = await createRoom(o.id, "Access checks");
  await inviteAgent(o.id, room.id, a.handle);
  const invitation = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: a.agent!.id },
  });
  const endpoint = `/api/rooms/${room.id}/messages`;
  const data = {
    body: "<script>window.mingloXss = true</script>",
    clientMessageId: randomUUID(),
    senderAgentId: other.agent!.id,
  };
  const options = { data, headers: { Origin: "http://localhost:3100" } };
  expect((await agent.request.post(endpoint, options)).status()).toBe(403); // invited only
  await respondToInvitation(a.id, invitation.id, true);
  expect((await owner.request.post(endpoint, options)).status()).toBe(403); // creator is read-only
  expect((await outsider.request.post(endpoint, options)).status()).toBe(403);
  expect(
    (
      await agent.request.post(endpoint, {
        ...options,
        headers: { Origin: "https://other.example" },
      })
    ).status(),
  ).toBe(403);
  expect((await agent.request.post(endpoint, { data })).status()).toBe(403); // missing Origin
  const responses = await Promise.all([
    agent.request.post(endpoint, options),
    agent.request.post(endpoint, options),
    agent.request.post(endpoint, options),
  ]);
  expect(responses.map((r) => r.status())).toEqual([200, 200, 200]);
  const bodies = await Promise.all(responses.map((r) => r.json()));
  expect(new Set(bodies.map((b) => b.message.id)).size).toBe(1);
  expect(bodies[0].message.senderAgentId).toBe(a.agent!.id); // forged author ignored
  expect(await db.message.count({ where: { roomId: room.id } })).toBe(1);
  expect(
    (
      await agent.request.post(endpoint, {
        ...options,
        data: { ...data, body: "Different text" },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await agent.request.post(endpoint, {
        ...options,
        data: { body: " ", clientMessageId: randomUUID() },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await agent.request.post(endpoint, {
        ...options,
        data: { body: "x".repeat(4001), clientMessageId: randomUUID() },
      })
    ).status(),
  ).toBe(400);
  await agent.goto(`/rooms/${room.id}`);
  await expect(agent.getByRole("log")).toContainText(data.body);
  expect(
    await agent.evaluate(
      () => (window as Window & { mingloXss?: boolean }).mingloXss,
    ),
  ).toBeUndefined();
  const token = await issueClaim(a.id);
  await consumeClaim(o.id, token.token);
  expect((await owner.request.get(endpoint)).status()).toBe(200);
  expect((await outsider.request.get(endpoint)).status()).toBe(404);
  // Polling must reauthorize on every request, even if a page was already open.
  await db.membership.update({
    where: { id: invitation.id },
    data: { status: "DECLINED" },
  });
  expect((await agent.request.get(endpoint)).status()).toBe(404);
  expect((await agent.request.post(endpoint, options)).status()).toBe(403);
  await agent.close();
  await owner.close();
  await outsider.close();
});
