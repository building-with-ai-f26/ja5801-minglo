import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { chromium } from "@playwright/test";
const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://minglo@127.0.0.1:55432/minglo_test?schema=public";
assert(
  new URL(databaseUrl).pathname.endsWith("_test"),
  "Restart check requires a disposable _test database.",
);
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const env = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: databaseUrl,
  AUTH_SECRET: randomBytes(48).toString("base64url"),
  AUTH_URL: "http://localhost:3100",
  AUTH_TRUST_HOST: "true",
};
let server;
let browser;
async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    { env, stdio: "ignore" },
  );
  for (let i = 0; i < 200; i++) {
    if (server.exitCode !== null)
      throw new Error("Production server exited before becoming ready.");
    try {
      if ((await fetch("http://127.0.0.1:3100/api/health")).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Production server did not become ready.");
}
async function stop() {
  if (server && server.exitCode === null) {
    const stopped = once(server, "exit");
    server.kill("SIGTERM");
    await stopped;
  }
  server = undefined;
}
async function check(room, handle, expectedIds, capture = false) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto("http://localhost:3100/login");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page
    .getByLabel("Password", { exact: true })
    .fill("OnlyForLocalTests_42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: /^Welcome back,/ }).waitFor();
  if (capture)
    await page.screenshot({ path: ".local/dashboard.png", fullPage: true });
  await page.goto(`http://localhost:3100/rooms/${room.id}`);
  await page
    .getByRole("log")
    .getByText("An earlier thought about birdsong.", { exact: true })
    .waitFor();
  const response = await page.request.get(
    `http://localhost:3100/api/rooms/${room.id}/messages`,
  );
  assert.equal(response.status(), 200);
  assert.deepEqual(
    (await response.json()).messages.map((m) => m.id),
    expectedIds,
  );
  if (capture)
    await page.screenshot({
      path: ".local/owner-transcript.png",
      fullPage: true,
    });
  await page.close();
}
async function checkFollowing(handle, expectedHandles) {
  const page = await browser.newPage();
  await page.goto("http://localhost:3100/login");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page
    .getByLabel("Password", { exact: true })
    .fill("OnlyForLocalTests_42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("http://localhost:3100/discover?view=following");
  await page.getByRole("heading", { name: "Accounts you follow" }).waitFor();
  const handles = await page
    .getByRole("article")
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute("aria-label").slice(1)),
    );
  assert.deepEqual(handles.sort(), [...expectedHandles].sort());
  await page.close();
}
try {
  const room = await db.room.findFirstOrThrow({
    where: { title: "The wondering room" },
    include: {
      messages: { orderBy: { id: "asc" } },
      memberships: {
        where: {
          status: "ACCEPTED",
          agent: { account: { handle: { startsWith: "talk_b_" } } },
        },
        include: { agent: { include: { account: true } } },
      },
    },
  });
  assert.equal(room.messages.length, 5, "Run npm test before this check.");
  const handle = room.memberships[0].agent.account.handle;
  const ids = room.messages.map((m) => m.id);
  const networkOwner = await db.account.findFirstOrThrow({
    where: { handle: { startsWith: "network_o_" } },
    select: {
      handle: true,
      following: { select: { target: { select: { handle: true } } } },
    },
  });
  const followedHandles = networkOwner.following.map((f) => f.target.handle);
  assert(
    followedHandles.length > 0,
    "Run the full npm test suite before this check.",
  );
  browser = await chromium.launch({
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : "chrome",
  });
  await start();
  await check(room, handle, ids);
  await checkFollowing(networkOwner.handle, followedHandles);
  if (process.argv.includes("--capture")) {
    mkdirSync(".local", { recursive: true });
    const owner = await db.account.findFirstOrThrow({
      where: { handle: { startsWith: "watch_" } },
    });
    await check(room, owner.handle, ids, true);
    const publicPage = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await publicPage.goto("http://localhost:3100");
    await publicPage.getByRole("heading", { name: /Your agent has/ }).waitFor();
    await publicPage.evaluate(() => document.fonts.ready.then(() => undefined));
    await publicPage.screenshot({ path: ".local/landing.png", fullPage: true });
    await publicPage.setViewportSize({ width: 390, height: 844 });
    await publicPage.getByRole("heading", { name: /Your agent has/ }).waitFor();
    await publicPage.screenshot({
      path: ".local/landing-mobile.png",
      fullPage: true,
    });
    assert(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Public entrance overflows a phone viewport.",
    );
    await publicPage.close();
  }
  await stop();
  await start();
  await check(room, handle, ids);
  await checkFollowing(networkOwner.handle, followedHandles);
  console.log(
    "PASS: production server stopped and restarted; the same five messages and the owner's following list persisted across fresh sign-ins.",
  );
} finally {
  await browser?.close();
  await stop();
  await db.$disconnect();
}
