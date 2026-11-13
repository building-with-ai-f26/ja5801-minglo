import { test, expect, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { hash } from "argon2";
import { db } from "../../src/lib/db";
import { register, login, password } from "./helpers";
import { createRoom } from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import {
  postPublicMessage,
  readPublicTranscript,
} from "../../src/lib/public-room";
import { safeNext } from "../../src/lib/validation";
const suffix = Date.now().toString(36);
const endpoint = "/api/public-room/messages";
const origin = { Origin: "http://localhost:3100" };
async function seed(label: string, type: "OWNER" | "AGENT" = "OWNER") {
  return db.account.create({
    data: {
      handle: `${label}_${suffix}`,
      passwordHash: await hash(password),
      type,
      ...(type === "AGENT"
        ? { agent: { create: { displayName: label } } }
        : { owner: { create: { displayName: label } } }),
    },
  });
}
async function send(page: Page, body: string) {
  await page.getByLabel("Your message", { exact: true }).fill(body);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("log")).toContainText(body);
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "",
  );
}
test.afterAll(async () => {
  await db.$disconnect();
});

test("public posting is limited per account while retries remain safe", async () => {
  const account = await seed("public_limit", "AGENT");
  const other = await seed("public_other");
  const first = { body: "A first message", clientMessageId: randomUUID() };
  const posted = await postPublicMessage(account.id, first);
  for (let i = 1; i < 30; i++) {
    await postPublicMessage(account.id, {
      body: `Message ${i}`,
      clientMessageId: randomUUID(),
    });
  }
  expect((await postPublicMessage(account.id, first)).id).toBe(posted.id);
  await expect(
    postPublicMessage(account.id, { ...first, body: "Changed" }),
  ).rejects.toMatchObject({ status: 409 });
  const attempts = await Promise.allSettled(
    Array.from({ length: 3 }, () =>
      postPublicMessage(account.id, {
        body: "Over limit",
        clientMessageId: randomUUID(),
      }),
    ),
  );
  expect(
    attempts.every(
      (result) => result.status === "rejected" && result.reason.status === 429,
    ),
  ).toBe(true);
  expect(
    await db.publicMessage.count({ where: { senderAccountId: account.id } }),
  ).toBe(30);
  await expect(
    postPublicMessage(other.id, {
      body: "Other account",
      clientMessageId: randomUUID(),
    }),
  ).resolves.toMatchObject({ body: "Other account" });
  const key = createHash("sha256")
    .update(`public-post:${account.id}`)
    .digest("hex");
  await db.rateLimit.update({ where: { key }, data: { resetAt: new Date(0) } });
  await expect(
    postPublicMessage(account.id, {
      body: "After reset",
      clientMessageId: randomUUID(),
    }),
  ).resolves.toMatchObject({ body: "After reset" });
});

test("new users and agents chat without invitations, see live updates, and retain separate private history", async ({
  browser,
}) => {
  const owner = await browser.newPage();
  const agent = await browser.newPage();
  await register(owner, `public_o_${suffix}`, "OWNER", "Community User");
  await register(agent, `public_a_${suffix}`, "AGENT", "Community Agent");
  const o = await db.account.findUniqueOrThrow({
    where: { handle: `public_o_${suffix}` },
  });
  const a = await db.account.findUniqueOrThrow({
    where: { handle: `public_a_${suffix}` },
  });
  const room = await createRoom(a.id, "Separate private conversation");
  await postMessage(room.id, a.id, {
    body: "Private text stays in its private room.",
    clientMessageId: randomUUID(),
  });
  await owner.locator(".secondary-nav > summary").click();
  await owner
    .getByRole("navigation", {
      name: "More destinations and account",
      exact: true,
    })
    .getByRole("link", { name: "Public chat", exact: true })
    .click();
  await agent.locator(".secondary-nav > summary").click();
  await agent
    .getByRole("navigation", {
      name: "More destinations and account",
      exact: true,
    })
    .getByRole("link", { name: "Public chat", exact: true })
    .click();
  await expect(
    owner.getByRole("heading", { name: "Public chat", exact: true }),
  ).toBeVisible();
  await send(owner, "Hello from a user in the public room.");
  await expect(agent.getByRole("log")).toContainText(
    "Hello from a user in the public room.",
  );
  await send(agent, "Hello from an agent in the public room.");
  await expect(owner.getByRole("log")).toContainText(
    "Hello from an agent in the public room.",
  );
  const userMessage = owner
    .getByRole("log")
    .locator("article")
    .filter({ hasText: "Hello from a user" });
  await expect(userMessage.getByText("User", { exact: true })).toBeVisible();
  await expect(userMessage).toHaveClass(/message-own/);
  await expect(userMessage.locator("time")).toHaveAttribute("datetime", /T/);
  await expect(
    agent
      .getByRole("log")
      .locator("article")
      .filter({ hasText: "Hello from an agent" })
      .getByText("Agent", { exact: true }),
  ).toBeVisible();
  await expect(owner.getByRole("log")).not.toContainText("Private text stays");
  expect(
    (await owner.request.get(`/api/rooms/${room.id}/messages`)).status(),
  ).toBe(404);
  await agent.goto(`/rooms/${room.id}`);
  await expect(agent.getByRole("log")).toContainText("Private text stays");
  await expect(agent.getByRole("log")).not.toContainText("Hello from a user");
  await agent.locator(".secondary-nav > summary").click();
  await agent
    .getByRole("navigation", {
      name: "More destinations and account",
      exact: true,
    })
    .getByRole("link", { name: "Public chat", exact: true })
    .click();
  await expect(agent.getByRole("log")).not.toContainText("Private text stays");
  expect(
    await db.membership.count({ where: { agent: { accountId: o.id } } }),
  ).toBe(0);
  await owner.setViewportSize({ width: 390, height: 844 });
  expect(
    await owner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await owner.screenshot({
    path: "test-results/public-room-mobile.png",
    fullPage: true,
  });
  await agent.screenshot({
    path: "test-results/public-room-desktop.png",
    fullPage: true,
  });
  const fresh = await browser.newPage();
  await fresh.goto("/public-room");
  await expect(fresh).toHaveURL(/\/login\?next=%2Fpublic-room/);
  await fresh.getByLabel("Handle", { exact: true }).fill(o.handle);
  await fresh.getByLabel("Password", { exact: true }).fill(password);
  await fresh.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(fresh).toHaveURL(/\/public-room$/);
  await expect(fresh.getByRole("log")).toContainText("Hello from an agent");
  await Promise.all([owner.close(), agent.close(), fresh.close()]);
});

test("public APIs authenticate, validate, reject CSRF, derive authorship, and deduplicate concurrent retries", async ({
  browser,
}) => {
  const account = await seed("public_api");
  const page = await browser.newPage();
  const guest = await browser.newPage();
  await login(page, account.handle);
  expect((await guest.request.get(endpoint)).status()).toBe(401);
  const data = {
    body: "<script>window.publicXss = true</script>",
    clientMessageId: randomUUID(),
    senderAccountId: "forged",
    accountType: "AGENT",
    roomId: "forged",
  };
  expect(
    (await guest.request.post(endpoint, { data, headers: origin })).status(),
  ).toBe(401);
  expect((await page.request.post(endpoint, { data })).status()).toBe(403);
  expect(
    (
      await page.request.post(endpoint, {
        data,
        headers: { Origin: "https://other.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(endpoint, {
        data: "hello",
        headers: { ...origin, "Content-Type": "text/plain" },
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await page.request.post(endpoint, {
        data: "{",
        headers: { ...origin, "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post(endpoint, {
        data: "x".repeat(20001),
        headers: { ...origin, "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(413);
  for (const after of ["-1", "invalid", "1.2", "9007199254740992"]) {
    expect(
      (await page.request.get(`${endpoint}?after=${after}`)).status(),
    ).toBe(400);
  }
  for (const invalid of [
    { body: " ", clientMessageId: randomUUID() },
    { body: "x".repeat(4001), clientMessageId: randomUUID() },
    { body: "hello", clientMessageId: "bad-id" },
  ]) {
    expect(
      (
        await page.request.post(endpoint, { data: invalid, headers: origin })
      ).status(),
    ).toBe(400);
  }
  const retries = await Promise.all(
    Array.from({ length: 3 }, () =>
      page.request.post(endpoint, { data, headers: origin }),
    ),
  );
  expect(retries.map((r) => r.status())).toEqual([200, 200, 200]);
  const results = await Promise.all(retries.map((r) => r.json()));
  expect(new Set(results.map((r) => r.message.id)).size).toBe(1);
  expect(results[0].message.senderAccountId).toBe(account.id);
  expect(results[0].message.accountType).toBe("OWNER");
  expect(
    await db.publicMessage.count({ where: { senderAccountId: account.id } }),
  ).toBe(1);
  expect(
    (
      await page.request.post(endpoint, {
        data: { ...data, body: "Changed" },
        headers: origin,
      })
    ).status(),
  ).toBe(409);
  const transcript = await page.request.get(endpoint);
  expect(transcript.headers()["cache-control"]).toContain("no-store");
  expect(JSON.stringify(await transcript.json())).not.toContain("passwordHash");
  await page.goto("/public-room");
  await expect(page.getByRole("log")).toContainText(data.body);
  expect(
    await page.evaluate(
      () => (window as Window & { publicXss?: boolean }).publicXss,
    ),
  ).toBeUndefined();
  await page.context().clearCookies();
  expect((await page.request.get(endpoint)).status()).toBe(401);
  expect(
    (await page.request.post(endpoint, { data, headers: origin })).status(),
  ).toBe(401);
  await expect(readPublicTranscript("missing-account")).rejects.toThrow(
    /Sign in/,
  );
  await expect(
    postPublicMessage("missing-account", {
      body: "hello",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toThrow(/Sign in/);
  expect(safeNext("/public-room")).toBe("/public-room");
  expect(safeNext("//other.example")).toBe("/dashboard");
  expect(safeNext("/public-room/../../evil")).toBe("/dashboard");
  await page.close();
  await guest.close();
});

test("public server actions reject cross-site and expired-session writes", async ({
  browser,
}) => {
  const account = await seed("public_guard");
  const page = await browser.newPage();
  await login(page, account.handle);
  for (const mode of ["cross-site", "no-session"]) {
    await page.goto("/public-room");
    await page.route("**/public-room", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const headers = { ...route.request().headers() };
      if (mode === "cross-site") headers.origin = "https://other.example";
      else headers.cookie = "";
      const response = await route.fetch({ headers, maxRedirects: 0 });
      if (mode === "no-session")
        expect(response.headers()["x-action-redirect"]).toContain("/login");
      await route.fulfill({ response });
    });
    await page
      .getByLabel("Your message", { exact: true })
      .fill("This request must be rejected.");
    const rejected = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/public-room",
    );
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    const response = await rejected;
    if (mode === "cross-site")
      expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(
      await db.publicMessage.count({ where: { senderAccountId: account.id } }),
    ).toBe(0);
    await page.unroute("**/public-room");
  }
  await page.close();
});

test("shared history pages older messages within a bounded window and writers remain ordered", async ({
  page,
}) => {
  const account = await seed("public_history", "AGENT");
  const other = await seed("public_history_user");
  await db.publicMessage.createMany({
    data: Array.from({ length: 205 }, (_, i) => ({
      senderAccountId: account.id,
      body: `Community history ${String(i + 1).padStart(3, "0")}`,
      clientMessageId: randomUUID(),
    })),
  });
  const writes = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      postPublicMessage(i % 2 ? account.id : other.id, {
        body: `Concurrent community thought ${i}`,
        clientMessageId: randomUUID(),
      }),
    ),
  );
  const ordered = [...writes].sort((a, b) => a.id - b.id);
  expect(
    (await readPublicTranscript(account.id, ordered[0].id - 1)).messages.map(
      (m) => m.id,
    ),
  ).toEqual(ordered.map((m) => m.id));
  await login(page, account.handle);
  await page.goto("/public-room");
  await expect(page.getByRole("log").locator("article")).toHaveCount(50);
  await expect(page.getByRole("log")).not.toContainText(
    "Community history 001",
  );
  // The initial poll proves the client transcript has hydrated before paging.
  await expect(
    page.getByRole("status").filter({ hasText: "Up to date" }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) {
    const firstRow = page.getByRole("log").locator("article").first();
    const oldestId = await firstRow.getAttribute("data-message-id");
    await page
      .getByRole("button", { name: "Load older messages", exact: true })
      .click();
    // Observe each completed page before clicking the next request.
    await expect(firstRow).not.toHaveAttribute("data-message-id", oldestId!);
  }
  await expect(page.getByRole("log")).toContainText("Community history 001");
  expect(
    await page.getByRole("log").locator("article").count(),
  ).toBeLessThanOrEqual(200);
  await page
    .getByRole("button", { name: "Latest messages", exact: true })
    .click();
  await expect(page.getByRole("log")).toContainText(
    "Concurrent community thought 7",
  );
  const ids = await page
    .getByRole("log")
    .locator("article")
    .evaluateAll((rows) =>
      rows.map((r) => Number(r.getAttribute("data-message-id"))),
    );
  expect(ids).toEqual([...ids].sort((a, b) => a - b));
  expect(new Set(ids).size).toBe(ids.length);
});
