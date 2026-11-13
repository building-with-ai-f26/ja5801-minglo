import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { db } from "../../src/lib/db";
import { register } from "./helpers";
import { searchAccounts } from "../../src/lib/discovery";
import { activityLabel, recordActivity } from "../../src/lib/activity";
import { createRoom } from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import {
  recordRoutineCheck,
  saveRoutineReport,
} from "../../src/lib/agent-routine";

const suffix = Date.now().toString(36);
test.afterAll(async () => {
  await db.$disconnect();
});
async function seed(
  handle: string,
  type: "AGENT" | "OWNER",
  data: {
    name: string;
    bio?: string;
    interests?: string;
    activity?: Date | null;
  },
) {
  return db.account.create({
    data: {
      handle,
      type,
      passwordHash: "private-directory-test-hash",
      lastActiveAt: data.activity ?? null,
      ...(type === "AGENT"
        ? {
            agent: {
              create: {
                displayName: data.name,
                bio: data.bio ?? "",
                interests: data.interests ?? "",
              },
            },
          }
        : { owner: { create: { displayName: data.name } } }),
    },
    include: { agent: true },
  });
}

test("browse profiles, filter agents, search bios and interests, and follow without unlocking private rooms", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const prefix = `dir_${suffix}`;
  const now = Date.now();
  const newest = await seed(`${prefix}_agent_new`, "AGENT", {
    name: "Orion",
    bio: `I explore greenhouses_${suffix} and botany.`,
    interests: `stargazing_${suffix}, robotics`,
    activity: new Date(now - 1000),
  });
  const person = await seed(`${prefix}_person`, "OWNER", {
    name: `Traveler ${suffix}`,
    activity: new Date(now - 2000),
  });
  const older = await seed(`${prefix}_agent_old`, "AGENT", {
    name: "Nova",
    bio: "I enjoy architecture",
    interests: "history",
    activity: new Date(now - 3000),
  });
  const unknown = await seed(`${prefix}_agent_unknown`, "AGENT", {
    name: "Sky",
    bio: "Waiting to explore",
  });
  await register(page, `${prefix}_viewer`, "OWNER", "Directory Viewer");
  const viewer = await db.account.findUniqueOrThrow({
    where: { handle: `${prefix}_viewer` },
  });
  const room = await createRoom(newest.id, "A private directory test");
  await page
    .getByRole("link", { name: "People & agents", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Profiles", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: `@${newest.handle}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: `@${person.handle}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: `@${viewer.handle}`, exact: true }),
  ).toHaveCount(0);
  const search = page.getByLabel(
    "Search by handle or display name, bio, or interests",
  );
  await search.fill(prefix);
  await page.getByRole("button", { name: "Search accounts" }).click();
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(4);
  expect(
    await cards.evaluateAll((items) =>
      items.map((item) => item.getAttribute("aria-label")),
    ),
  ).toEqual([
    `@${newest.handle}`,
    `@${person.handle}`,
    `@${older.handle}`,
    `@${unknown.handle}`,
  ]);
  await expect(cards.first()).toContainText("Active recently");
  await expect(cards.last()).toContainText("Activity not recorded");
  await page.getByLabel("Account type", { exact: true }).selectOption("AGENT");
  await page.getByRole("button", { name: "Search accounts" }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(
    page.getByRole("article", { name: `@${person.handle}`, exact: true }),
  ).toHaveCount(0);
  await search.fill(`STARGAZING_${suffix}`);
  await page.getByRole("button", { name: "Search accounts" }).click();
  const found = page.getByRole("article", {
    name: `@${newest.handle}`,
    exact: true,
  });
  await expect(found).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await found.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    found.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
  expect(
    (await page.request.get(`/api/rooms/${room.id}/messages`)).status(),
  ).toBe(404);
  await search.fill(`greenhouses_${suffix}`);
  await page.getByRole("button", { name: "Search accounts" }).click();
  await expect(
    page.getByRole("article", { name: `@${newest.handle}`, exact: true }),
  ).toBeVisible();
  await page.goto("/discover?view=following");
  await expect(
    page.getByRole("article", { name: `@${newest.handle}`, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/directory-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/discover?q=${encodeURIComponent(prefix)}`);
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.screenshot({
    path: "test-results/directory-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("article", { name: `@${newest.handle}`, exact: true })
    .getByRole("link", {
      name: `View @${newest.handle}'s profile`,
      exact: true,
    })
    .locator(".avatar")
    .click();
  await expect(
    page.getByRole("heading", { name: "Orion", exact: true }),
  ).toBeVisible();
  await page.goto("/discover?view=following");
  const profileLink = page
    .getByRole("article", { name: `@${newest.handle}`, exact: true })
    .getByRole("link", { name: "View profile", exact: true });
  await profileLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/profiles/${newest.handle}`);
  await page.goto(`/discover?q=${encodeURIComponent(prefix)}`);
  await page
    .getByRole("article", { name: `@${person.handle}`, exact: true })
    .getByRole("link", {
      name: `View @${person.handle}'s profile`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: `Traveler ${suffix}`, exact: true }),
  ).toBeVisible();
});

test("activity sorts deterministically, uses coarse labels, throttles visits, and never goes backwards", async () => {
  const prefix = `sort_${suffix}`;
  const viewer = await seed(`${prefix}_viewer`, "OWNER", { name: "Viewer" });
  const stamp = new Date();
  const a = await seed(`${prefix}_a`, "AGENT", { name: "A", activity: stamp });
  const b = await seed(`${prefix}_b`, "AGENT", { name: "B", activity: stamp });
  const old = await seed(`${prefix}_old`, "AGENT", {
    name: "Old",
    activity: new Date(stamp.getTime() - 86400000 * 14),
  });
  const never = await seed(`${prefix}_never`, "AGENT", { name: "Unknown" });
  const result = await searchAccounts(viewer.id, { q: prefix });
  expect(result.accounts.map((account) => account.handle)).toEqual([
    a.handle,
    b.handle,
    old.handle,
    never.handle,
  ]);
  expect(result.accounts.map((account) => account.activity)).toEqual([
    "Active recently",
    "Active recently",
    "Active earlier",
    "Activity not recorded",
  ]);
  expect(JSON.stringify(result.accounts)).not.toContain(
    "private-directory-test-hash",
  );
  expect(result.accounts[0]).not.toHaveProperty("lastActiveAt");
  expect(activityLabel(new Date(stamp.getTime() - 2 * 3600000), stamp)).toBe(
    "Active in the last day",
  );
  expect(activityLabel(new Date(stamp.getTime() - 3 * 86400000), stamp)).toBe(
    "Active this week",
  );
  await recordActivity(a.id, { now: new Date(stamp.getTime() + 30_000) });
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: a.id } })).lastActiveAt,
  ).toEqual(stamp);
  await recordActivity(a.id, { now: new Date(stamp.getTime() + 61_000) });
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: a.id } })).lastActiveAt,
  ).toEqual(new Date(stamp.getTime() + 61_000));
  await recordActivity(a.id, { now: stamp, force: true });
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: a.id } })).lastActiveAt,
  ).toEqual(new Date(stamp.getTime() + 61_000));
  await recordActivity(a.id, {
    now: new Date(stamp.getTime() + 62_000),
    force: true,
  });
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: a.id } })).lastActiveAt,
  ).toEqual(new Date(stamp.getTime() + 62_000));
});

test("message and agent check-in activity is recorded only for the authenticated acting account", async () => {
  const agent = await seed(`events_${suffix}_a`, "AGENT", {
    name: "Agent",
    activity: new Date(0),
  });
  const outsider = await seed(`events_${suffix}_b`, "AGENT", {
    name: "Outsider",
    activity: new Date(0),
  });
  const owner = await seed(`events_${suffix}_o`, "OWNER", {
    name: "Owner",
    activity: new Date(0),
  });
  const room = await createRoom(agent.id, "Activity remains private");
  const before = Date.now();
  await postMessage(room.id, agent.id, {
    body: "A private test thought",
    clientMessageId: randomUUID(),
  });
  expect(
    (
      await db.account.findUniqueOrThrow({ where: { id: agent.id } })
    ).lastActiveAt!.getTime(),
  ).toBeGreaterThanOrEqual(before);
  await expect(
    postMessage(room.id, outsider.id, {
      body: "Forbidden",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toThrow();
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: outsider.id } }))
      .lastActiveAt,
  ).toEqual(new Date(0));
  await postPublicMessage(owner.id, {
    body: "A public test thought",
    clientMessageId: randomUUID(),
    senderAccountId: outsider.id,
  });
  expect(
    (
      await db.account.findUniqueOrThrow({ where: { id: owner.id } })
    ).lastActiveAt!.getTime(),
  ).toBeGreaterThanOrEqual(before);
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: outsider.id } }))
      .lastActiveAt,
  ).toEqual(new Date(0));
  await saveRoutineReport(agent.id, {
    host: "MUSE",
    status: "REPORTED_READY",
    intervalMinutes: 5,
    taskReference: "fixture-task",
  });
  await db.account.update({
    where: { id: agent.id },
    data: { lastActiveAt: new Date(0) },
  });
  await recordRoutineCheck(agent.id);
  expect(
    (
      await db.account.findUniqueOrThrow({ where: { id: agent.id } })
    ).lastActiveAt!.getTime(),
  ).toBeGreaterThanOrEqual(before);
});

test("activity endpoint rejects cross-site and unauthenticated requests and ignores forged identities", async ({
  browser,
}) => {
  const page = await browser.newPage();
  const guest = await browser.newPage();
  const target = await seed(`track_${suffix}_target`, "AGENT", {
    name: "Target",
    activity: new Date(0),
  });
  await register(page, `track_${suffix}_viewer`, "OWNER");
  const own = await db.account.findUniqueOrThrow({
    where: { handle: `track_${suffix}_viewer` },
  });
  const headers = {
    Origin: "http://localhost:3100",
    "Content-Type": "application/json",
  };
  expect(
    (await guest.request.post("/api/activity", { headers, data: {} })).status(),
  ).toBe(401);
  expect(
    (await page.request.post("/api/activity", { data: {} })).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/activity", {
        headers: { ...headers, Origin: "https://example.org" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/activity", {
        headers: { ...headers, "Content-Type": "text/plain" },
        data: "x",
      })
    ).status(),
  ).toBe(415);
  await db.account.update({
    where: { id: own.id },
    data: { lastActiveAt: new Date(0) },
  });
  const response = await page.request.post("/api/activity", {
    headers,
    data: { accountId: target.id, lastActiveAt: "2099-01-01" },
  });
  expect(response.status()).toBe(204);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(
    (
      await db.account.findUniqueOrThrow({ where: { id: own.id } })
    ).lastActiveAt!.getTime(),
  ).toBeGreaterThan(Date.now() - 5000);
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: target.id } }))
      .lastActiveAt,
  ).toEqual(new Date(0));
  await page.close();
  await guest.close();
});

test("migration backfills existing accounts from their latest recorded activity", async () => {
  const migration = readFileSync(
    "prisma/migrations/202611060004_profile_activity/migration.sql",
    "utf8",
  );
  const start = migration.indexOf("WITH observed_activity AS (");
  const end = migration.indexOf("-- CreateIndex", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const rollback = new Error("roll back migration fixture");
  await expect(
    db.$transaction(
      async (tx) => {
        const actor = await tx.account.create({
          data: {
            handle: `migration_${suffix}_agent`,
            type: "AGENT",
            passwordHash: "unchanged",
            createdAt: new Date("2020-01-01T00:00:00Z"),
            agent: { create: { displayName: "Existing agent" } },
          },
          include: { agent: true },
        });
        const owner = await tx.account.create({
          data: {
            handle: `migration_${suffix}_owner`,
            type: "OWNER",
            passwordHash: "unchanged",
            createdAt: new Date("2021-01-01T00:00:00Z"),
            owner: { create: { displayName: "Existing owner" } },
          },
        });
        const signup = await tx.account.create({
          data: {
            handle: `migration_${suffix}_signup`,
            type: "OWNER",
            passwordHash: "unchanged",
            createdAt: new Date("2019-01-01T00:00:00Z"),
          },
        });
        const room = await tx.room.create({
          data: { title: "Existing private room", creatorAccountId: actor.id },
        });
        const message = await tx.message.create({
          data: {
            roomId: room.id,
            senderAgentId: actor.agent!.id,
            body: "Existing private message",
            clientMessageId: randomUUID(),
            createdAt: new Date("2022-01-01T00:00:00Z"),
          },
        });
        await tx.publicMessage.create({
          data: {
            senderAccountId: owner.id,
            body: "Existing public message",
            clientMessageId: randomUUID(),
            createdAt: new Date("2023-01-01T00:00:00Z"),
          },
        });
        await tx.agentRoutine.create({
          data: {
            agentId: actor.agent!.id,
            lastCheckAt: new Date("2024-01-01T00:00:00Z"),
          },
        });
        await tx.$executeRawUnsafe(migration.slice(start, end).trim());
        const accounts = await tx.account.findMany({
          where: { id: { in: [actor.id, owner.id, signup.id] } },
        });
        expect(
          accounts.find((account) => account.id === actor.id)?.lastActiveAt,
        ).toEqual(new Date("2024-01-01T00:00:00Z"));
        expect(
          accounts.find((account) => account.id === owner.id)?.lastActiveAt,
        ).toEqual(new Date("2023-01-01T00:00:00Z"));
        expect(
          accounts.find((account) => account.id === signup.id)?.lastActiveAt,
        ).toEqual(new Date("2019-01-01T00:00:00Z"));
        expect(
          (await tx.message.findUniqueOrThrow({ where: { id: message.id } }))
            .body,
        ).toBe("Existing private message");
        throw rollback;
      },
      { timeout: 15000 },
    ),
  ).rejects.toBe(rollback);
});
