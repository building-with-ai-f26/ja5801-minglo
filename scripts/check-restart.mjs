import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes, createHash } from "node:crypto";
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
// Persistence snapshots use simulated background tabs. Foreground automatic
// acknowledgments have dedicated visibility tests; these reads must not mutate
// the persisted snapshot that this restart check compares byte for byte.
async function backgroundPage(options) {
  const page = await browser.newPage(options);
  await page.addInitScript(() => {
    Object.defineProperty(document, "visibilityState", { get: () => "hidden" });
    Object.defineProperty(document, "hidden", { get: () => true });
  });
  return page;
}

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
  const page = await backgroundPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto("http://localhost:3100/login");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page
    .getByLabel("Password", { exact: true })
    .fill("OnlyForLocalTests_42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { level: 1 }).waitFor();
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
  const page = await backgroundPage();
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
async function checkPublic(handle, expectedIds) {
  const page = await backgroundPage();
  await page.goto("http://localhost:3100/login");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page
    .getByLabel("Password", { exact: true })
    .fill("OnlyForLocalTests_42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("http://localhost:3100/public-room");
  await page.getByRole("log").waitFor();
  assert(
    (await page.getByRole("log").locator("article").count()) <= 50,
    "The initial public view must remain bounded.",
  );
  await page.getByLabel("Your message", { exact: true }).waitFor();
  const actual = [];
  const bodies = new Set();
  let after = 0;
  while (true) {
    const response = await page.request.get(
      `http://localhost:3100/api/public-room/messages?after=${after}`,
    );
    assert.equal(response.status(), 200);
    const result = await response.json();
    actual.push(...result.messages.map((m) => m.id));
    for (const message of result.messages) bodies.add(message.body);
    if (!result.hasMore) break;
    after = actual.at(-1);
  }
  assert.deepEqual(actual, expectedIds);
  assert(bodies.has("Hello from a user in the public room."));
  assert(bodies.has("Hello from an agent in the public room."));
  await page.close();
}
async function checkRoutine(account) {
  const page = await backgroundPage();
  await page.goto("http://localhost:3100/login");
  await page.getByLabel("Handle", { exact: true }).fill(account.handle);
  await page
    .getByLabel("Password", { exact: true })
    .fill("OnlyForLocalTests_42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("http://localhost:3100/agent-setup");
  const status = page.getByRole("region", {
    name: "Your ongoing visit status",
  });
  await status.getByText("Host task reported", { exact: true }).waitFor();
  assert.equal(
    await status.locator("time").getAttribute("datetime"),
    account.agent.routine.lastCheckAt.toISOString(),
  );
  assert.equal(
    await page
      .getByLabel("Confirmed task name or ID", { exact: true })
      .inputValue(),
    account.agent.routine.taskReference,
  );
  assert.equal(
    await page
      .getByLabel("Actual check interval (minutes)", { exact: true })
      .inputValue(),
    String(account.agent.routine.intervalMinutes),
  );
  await page.close();
}
async function checkDirect() {
  const chat = await db.directConversation.findFirstOrThrow({
    where: {
      status: "ACTIVE",
      requestedBy: { handle: { startsWith: "dui_" } },
      messages: { some: { requestVersion: null } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      requestedBy: { select: { handle: true } },
      messages: { orderBy: { id: "desc" }, take: 50, select: { id: true } },
    },
  });
  const page = await backgroundPage();
  await page.goto("http://localhost:3100/login");
  await page
    .getByLabel("Handle", { exact: true })
    .fill(chat.requestedBy.handle);
  await page
    .getByLabel("Password", { exact: true })
    .fill("OnlyForLocalTests_42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto(`http://localhost:3100/messages/${chat.id}`);
  await page.getByRole("log").waitFor();
  await page.getByRole("heading", { name: "Who can read this chat" }).waitFor();
  const response = await page.request.get(
    `http://localhost:3100/api/messages/${chat.id}/messages?recent=1`,
  );
  assert.equal(response.status(), 200);
  const transcript = await response.json();
  assert.equal(transcript.conversation.status, "ACTIVE");
  assert.deepEqual(
    transcript.messages.map((m) => m.id),
    chat.messages.map((m) => m.id).reverse(),
  );
  await page.close();
}
async function checkTutorial() {
  const viewer = await db.account.findFirstOrThrow({
    where: {
      handle: { startsWith: "tour_" },
      tourPreference: { status: "COMPLETED" },
    },
    include: { tourPreference: true },
  });
  const page = await backgroundPage();
  await page.goto("http://localhost:3100/login");
  await page.getByLabel("Handle", { exact: true }).fill(viewer.handle);
  await page
    .getByLabel("Password", { exact: true })
    .fill("OnlyForLocalTests_42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(
    await page.getByRole("region", { name: "Welcome tutorial" }).count(),
    0,
  );
  await page.goto("http://localhost:3100/settings");
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Show a welcome tutorial automatically" })
      .isChecked(),
    viewer.tourPreference.autoOfferEnabled,
  );
  await page
    .getByRole("button", { name: "Replay tour", exact: true })
    .waitFor();
  await page.close();
}

async function continuityState() {
  // Compare only durable social/security fields; page activity timestamps change on sign-in.
  const tables = await Promise.all([
    db.readPosition.findMany({
      orderBy: [{ accountId: "asc" }, { conversationKey: "asc" }],
    }),
    db.attentionItem.findMany({ orderBy: { id: "asc" } }),
    db.conversationPreference.findMany({
      orderBy: [{ accountId: "asc" }, { conversationKey: "asc" }],
    }),
    db.accountBlock.findMany({
      orderBy: [{ blockerAccountId: "asc" }, { targetAccountId: "asc" }],
    }),
    db.recoveryCode.findMany({ orderBy: { id: "asc" } }),
    db.messageReport.findMany({ orderBy: { id: "asc" } }),
    db.message.findMany({
      where: { replyToId: { not: null } },
      select: { id: true, replyToId: true },
      orderBy: { id: "asc" },
    }),
    db.publicMessage.findMany({
      where: { replyToId: { not: null } },
      select: { id: true, replyToId: true },
      orderBy: { id: "asc" },
    }),
    db.account.findMany({
      where: { sessionVersion: { gt: 0 } },
      select: { id: true, sessionVersion: true },
      orderBy: { id: "asc" },
    }),
    db.agent.findMany({
      select: {
        id: true,
        participationPausedAt: true,
        participationPausedByAccountId: true,
      },
      orderBy: { id: "asc" },
    }),
    db.directConversation.findMany({ orderBy: { id: "asc" } }),
    db.directMessage.findMany({ orderBy: { id: "asc" } }),
    db.accountTourPreference.findMany({ orderBy: { accountId: "asc" } }),
  ]);
  assert(
    tables.every((rows) => rows.length > 0),
    "Run the complete browser suite before checking continuity persistence.",
  );
  // Never print report reasons, recovery hashes or private content in verification output.
  return createHash("sha256").update(JSON.stringify(tables)).digest("hex");
}
async function checkAttention(account) {
  const page = await backgroundPage();
  await page.goto("http://localhost:3100/login");
  await page.getByLabel("Handle", { exact: true }).fill(account.handle);
  await page
    .getByLabel("Password", { exact: true })
    .fill("OnlyForLocalTests_42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("http://localhost:3100/inbox?view=updates");
  const attention = page.getByRole("region", {
    name: "Replies, mentions and updates",
  });
  await attention
    .getByText(`Public reply @${account.handle}`, { exact: true })
    .waitFor();
  assert(
    !(await attention.textContent()).includes("Another private message"),
    "Revoked private attention must not reappear after restart.",
  );
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
  const publicAccounts = await db.account.findMany({
    where: {
      publicMessages: {
        some: {
          body: {
            in: [
              "Hello from a user in the public room.",
              "Hello from an agent in the public room.",
            ],
          },
        },
      },
    },
    select: { handle: true },
  });
  assert.equal(
    publicAccounts.length,
    2,
    "Run the public-room browser tests first.",
  );
  const publicIds = (
    await db.publicMessage.findMany({
      orderBy: { id: "asc" },
      select: { id: true },
    })
  ).map((m) => m.id);
  assert(publicIds.length >= 2, "Public messages must exist before restart.");
  const routineAccount = await db.account.findFirstOrThrow({
    where: {
      agent: {
        routine: {
          taskReference: "Minglo conversation check: confirmed host task",
        },
      },
    },
    include: { agent: { include: { routine: true } } },
  });
  assert(
    routineAccount.agent.routine.lastCheckAt,
    "Run the ongoing-visit browser tests first.",
  );
  const attentionAccount = await db.account.findFirstOrThrow({
    where: { handle: { startsWith: "attention_b_" } },
    select: { handle: true },
  });
  const expectedContinuity = await continuityState();
  browser = await chromium.launch({
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : "chrome",
  });
  await start();
  await check(room, handle, ids);
  await checkFollowing(networkOwner.handle, followedHandles);
  for (const account of publicAccounts)
    await checkPublic(account.handle, publicIds);
  await checkRoutine(routineAccount);
  await checkAttention(attentionAccount);
  await checkDirect();
  await checkTutorial();
  assert.equal(await continuityState(), expectedContinuity);
  if (process.argv.includes("--capture")) {
    mkdirSync(".local", { recursive: true });
    const owner = await db.account.findFirstOrThrow({
      where: { handle: { startsWith: "watch_" } },
    });
    await check(room, owner.handle, ids, true);
    const publicPage = await backgroundPage({
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
  for (const account of publicAccounts)
    await checkPublic(account.handle, publicIds);
  await checkRoutine(routineAccount);
  await checkAttention(attentionAccount);
  await checkDirect();
  await checkTutorial();
  assert.equal(await continuityState(), expectedContinuity);
  console.log(
    "PASS: production restart retained private/public/direct history and request state, follows, host reports/check-ins, read positions, replies, attention, preferences, blocks, recovery/session versions, reports, tutorial preferences/completion and posting permissions. Fresh Messages sign-in showed the public reply and withheld revoked private attention; direct chat UI/API retained its accepted state and message IDs.",
  );
} finally {
  await browser?.close();
  await stop();
  await db.$disconnect();
}
