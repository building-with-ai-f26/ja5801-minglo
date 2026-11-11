import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import {
  searchAccounts,
  setFollowing,
  followedAgentsForRoom,
  PAGE_SIZE,
} from "../../src/lib/discovery";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
  readTranscript,
} from "../../src/lib/rooms";
import { register } from "./helpers";

const suffix = Date.now().toString(36);
test.afterAll(async () => {
  await db.$disconnect();
});
async function seed(
  handle: string,
  type: "OWNER" | "AGENT",
  displayName: string,
) {
  return db.account.create({
    data: {
      handle,
      type,
      passwordHash: "private-fixture-hash",
      ...(type === "AGENT"
        ? {
            agent: {
              create: {
                displayName,
                bio: "A curious agent.",
                interests: "Science, Design",
              },
            },
          }
        : { owner: { create: { displayName } } }),
    },
    include: { agent: true },
  });
}

test("owners and agents search, follow, unfollow, and invite a followed agent without bypassing acceptance", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const owner = await browser.newPage();
  const agent = await browser.newPage();
  const ownerHandle = `network_o_${suffix}`;
  const agentHandle = `network_a_${suffix}`;
  await register(owner, ownerHandle, "OWNER", "Network Owner");
  await register(agent, agentHandle, "AGENT", `Orbit Agent ${suffix}`);
  const person = await seed(
    `network_u_${suffix}`,
    "OWNER",
    `Orbit Person ${suffix}`,
  );
  const o = await db.account.findUniqueOrThrow({
    where: { handle: ownerHandle },
  });
  const a = await db.account.findUniqueOrThrow({
    where: { handle: agentHandle },
  });
  await owner.getByRole("link", { name: "Explore", exact: true }).click();
  await owner.getByLabel("Search by handle or display name").fill(`network_`);
  await owner.getByRole("button", { name: "Search accounts" }).click();
  await expect(
    owner.getByRole("article", { name: `@${agentHandle}`, exact: true }),
  ).toBeVisible();
  await expect(
    owner.getByRole("article", { name: `@${person.handle}`, exact: true }),
  ).toBeVisible();
  await expect(
    owner.getByRole("article", { name: `@${ownerHandle}`, exact: true }),
  ).toHaveCount(0);
  await owner.getByLabel("Account type", { exact: true }).selectOption("AGENT");
  await owner.getByRole("button", { name: "Search accounts" }).click();
  await expect(
    owner.getByRole("article", { name: `@${person.handle}`, exact: true }),
  ).toHaveCount(0);
  const agentCard = owner.getByRole("article", {
    name: `@${agentHandle}`,
    exact: true,
  });
  // A forged follower field must not override the signed-in account.
  await agentCard.locator("form").evaluate((form, forgedId) => {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "followerId";
    field.value = forgedId;
    form.append(field);
  }, person.id);
  await agentCard.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    agentCard.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
  expect(
    await db.follow.count({ where: { followerId: o.id, targetId: a.id } }),
  ).toBe(1);
  expect(
    await db.follow.count({ where: { followerId: person.id, targetId: a.id } }),
  ).toBe(0);
  await owner.getByLabel("Account type", { exact: true }).selectOption("OWNER");
  await owner.getByRole("button", { name: "Search accounts" }).click();
  const personCard = owner.getByRole("article", {
    name: `@${person.handle}`,
    exact: true,
  });
  await personCard.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    personCard.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
  // Agent accounts can follow people, using a case-insensitive @handle search.
  await agent.goto(
    `/discover?q=${encodeURIComponent("@" + ownerHandle.toUpperCase())}`,
  );
  await agent
    .getByRole("article", { name: `@${ownerHandle}`, exact: true })
    .getByRole("button", { name: "Follow", exact: true })
    .click();
  await expect(
    agent.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
  await owner.goto("/discover?view=following");
  await owner.reload();
  await expect(owner.getByRole("article")).toHaveCount(2);
  await db.$disconnect();
  expect(await db.follow.count({ where: { followerId: o.id } })).toBe(2);
  await owner.goto("/rooms/new");
  await owner.getByLabel("Room name").fill("Network conversation");
  await owner.getByRole("button", { name: "Create private room" }).click();
  await expect(
    owner.getByRole("heading", { name: "Network conversation" }),
  ).toBeVisible();
  const roomUrl = owner.url();
  const roomId = new URL(roomUrl).pathname.split("/").pop()!;
  const shortcuts = owner.getByRole("region", {
    name: "Invite agents you follow",
  });
  await expect(
    shortcuts.getByRole("button", {
      name: `Invite @${agentHandle}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    shortcuts.getByRole("button", {
      name: `Invite @${person.handle}`,
      exact: true,
    }),
  ).toHaveCount(0);
  await agent.goto(roomUrl);
  await expect(
    agent.getByRole("heading", { name: "Nothing to see here." }),
  ).toBeVisible();
  expect(
    (await agent.request.get(`/api/rooms/${roomId}/messages`)).status(),
  ).toBe(404);
  await shortcuts
    .getByRole("button", { name: `Invite @${agentHandle}`, exact: true })
    .click();
  await expect(owner.getByText("Invited", { exact: true })).toBeVisible();
  await expect(
    shortcuts.getByRole("button", {
      name: `Invite @${agentHandle}`,
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    (await agent.request.get(`/api/rooms/${roomId}/messages`)).status(),
  ).toBe(404);
  await agent.goto("/dashboard");
  await agent.getByRole("button", { name: "Accept invitation" }).click();
  await agent.goto(roomUrl);
  await expect(agent.getByLabel("Your message", { exact: true })).toBeVisible();
  await expect(
    agent.getByRole("region", { name: "Invite agents you follow" }),
  ).toHaveCount(0);
  await owner.goto("/discover?view=following");
  await owner
    .getByRole("article", { name: `@${agentHandle}`, exact: true })
    .getByRole("button", { name: "Unfollow", exact: true })
    .click();
  await expect(
    owner.getByRole("article", { name: `@${agentHandle}`, exact: true }),
  ).toHaveCount(0);
  await expect(
    owner.getByRole("article", { name: `@${person.handle}`, exact: true }),
  ).toBeVisible();
  expect(
    (await agent.request.get(`/api/rooms/${roomId}/messages`)).status(),
  ).toBe(200);
  await owner.goto("/discover?q=Orbit");
  await owner.setViewportSize({ width: 1440, height: 1000 });
  await expect(owner.getByRole("article")).toHaveCount(2);
  await owner.screenshot({
    path: "test-results/discover-desktop.png",
    fullPage: true,
  });
  await owner.setViewportSize({ width: 390, height: 844 });
  expect(
    await owner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await owner.screenshot({
    path: "test-results/discover-mobile.png",
    fullPage: true,
  });
  await owner.close();
  await agent.close();
});

test("following is idempotent, cannot target self/missing accounts, and never grants room access or invitation rights", async () => {
  const owner = await seed(`follow_o_${suffix}`, "OWNER", "Owner");
  const agent = await seed(`follow_a_${suffix}`, "AGENT", "Agent");
  const other = await seed(`follow_b_${suffix}`, "AGENT", "Other");
  await Promise.all([
    setFollowing(owner.id, agent.id, true),
    setFollowing(owner.id, agent.id, true),
    setFollowing(owner.id, agent.id, true),
  ]);
  expect(
    await db.follow.count({
      where: { followerId: owner.id, targetId: agent.id },
    }),
  ).toBe(1);
  await expect(setFollowing(owner.id, owner.id, true)).rejects.toThrow(
    /yourself/,
  );
  await expect(
    db.follow.create({ data: { followerId: owner.id, targetId: owner.id } }),
  ).rejects.toThrow();
  await expect(
    setFollowing(owner.id, "c000000000000000000000000", true),
  ).rejects.toThrow(/no longer available/);
  await expect(setFollowing(owner.id, "invalid-id", true)).rejects.toThrow(
    /valid account/,
  );
  await setFollowing(agent.id, owner.id, true);
  await setFollowing(other.id, agent.id, true);
  const room = await createRoom(agent.id, "Private agent conversation");
  expect(await readTranscript(room.id, owner.id)).toBeNull();
  await expect(followedAgentsForRoom(owner.id, room.id)).rejects.toThrow(
    /creator/,
  );
  await expect(inviteAgent(owner.id, room.id, other.handle)).rejects.toThrow(
    /creator/,
  );
  await setFollowing(agent.id, other.id, true);
  expect(
    (await followedAgentsForRoom(agent.id, room.id)).map((a) => a.handle),
  ).toEqual([other.handle]);
  await inviteAgent(agent.id, room.id, other.handle);
  expect(await followedAgentsForRoom(agent.id, room.id)).toHaveLength(0);
  expect(await readTranscript(room.id, other.id)).toBeNull();
  const invite = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: other.agent!.id },
  });
  await respondToInvitation(other.id, invite.id, false);
  expect(await followedAgentsForRoom(agent.id, room.id)).toHaveLength(1);
  await setFollowing(owner.id, agent.id, false);
  await setFollowing(owner.id, agent.id, false);
  expect(await db.follow.count({ where: { followerId: owner.id } })).toBe(0);
  expect(
    await db.follow.count({
      where: { followerId: agent.id, targetId: owner.id },
    }),
  ).toBe(1);
});

test("search is bounded, case-insensitive, literal, filtered, paginated, and returns only safe profile fields", async () => {
  const viewer = await seed(`search_view_${suffix}`, "OWNER", "Viewer");
  const rows = await Promise.all(
    Array.from({ length: 23 }, (_, i) =>
      seed(
        `page_${suffix}_${String(i).padStart(2, "0")}`,
        i % 2 ? "AGENT" : "OWNER",
        `Page ${suffix} ${i}`,
      ),
    ),
  );
  const first = await searchAccounts(viewer.id, { q: `PAGE ${suffix}` });
  expect(first.accounts).toHaveLength(PAGE_SIZE);
  expect(first.hasMore).toBe(true);
  const second = await searchAccounts(viewer.id, {
    q: `page ${suffix}`,
    page: 2,
  });
  expect(second.accounts).toHaveLength(3);
  expect(second.hasMore).toBe(false);
  expect([...first.accounts, ...second.accounts].map((a) => a.handle)).toEqual(
    rows.map((a) => a.handle),
  );
  const agents = await searchAccounts(viewer.id, {
    q: `page ${suffix}`,
    type: "AGENT",
  });
  expect(agents.accounts).toHaveLength(11);
  expect(agents.accounts.every((a) => a.type === "AGENT")).toBe(true);
  const users = await searchAccounts(viewer.id, {
    q: `page ${suffix}`,
    type: "OWNER",
  });
  expect(users.accounts).toHaveLength(12);
  expect(Object.keys(first.accounts[0]).sort()).toEqual(
    [
      "id",
      "handle",
      "type",
      "displayName",
      "bio",
      "interests",
      "activity",
      "isFollowing",
    ].sort(),
  );
  expect(JSON.stringify(first)).not.toContain("private-fixture-hash");
  await setFollowing(viewer.id, rows[0].id, true);
  expect(
    (await searchAccounts(viewer.id, { view: "following" })).accounts.map(
      (a) => a.id,
    ),
  ).toEqual([rows[0].id]);
  await db.owner.update({
    where: { accountId: rows[0].id },
    data: { displayName: "Renamed profile" },
  });
  expect(
    (await searchAccounts(viewer.id, { view: "following" })).accounts[0]
      .displayName,
  ).toBe("Renamed profile");
  expect(
    (await searchAccounts(rows[1].id, { view: "following" })).accounts,
  ).toHaveLength(0);
  const browse = await searchAccounts(viewer.id, {});
  expect(browse.accounts.length).toBeGreaterThan(0);
  expect(browse.accounts.every((account) => account.id !== viewer.id)).toBe(
    true,
  );
  expect(
    (await searchAccounts(viewer.id, { q: "nothing_matches_this_name" }))
      .accounts,
  ).toHaveLength(0);
  await seed(`literal_${suffix}`, "AGENT", "100% curious");
  await seed(`literalx${suffix}`, "AGENT", "100x curious");
  expect(
    (await searchAccounts(viewer.id, { q: "100%" })).accounts,
  ).toHaveLength(1);
  expect(
    (await searchAccounts(viewer.id, { q: "literal_" })).accounts.map(
      (a) => a.handle,
    ),
  ).toEqual([`literal_${suffix}`]);
  await expect(
    searchAccounts(viewer.id, { q: "x".repeat(61) }),
  ).rejects.toThrow();
  await expect(searchAccounts(viewer.id, { page: -1 })).rejects.toThrow();
});

test("discovery requires sign-in and follow actions reject cross-site or unauthenticated mutations", async ({
  browser,
}) => {
  const signedOut = await browser.newPage();
  await signedOut.goto("/discover?q=anything");
  await expect(signedOut).toHaveURL(/\/login/);
  await signedOut.close();
  const page = await browser.newPage();
  await register(page, `guard_${suffix}`, "OWNER");
  const target = await seed(`guard_target_${suffix}`, "AGENT", "Guarded Agent");
  const follower = await db.account.findUniqueOrThrow({
    where: { handle: `guard_${suffix}` },
  });
  const url = `/discover?q=${target.handle}`;
  await page.goto(url);
  await page.route("**/discover**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch({
      headers: {
        ...route.request().headers(),
        origin: "https://other.example",
      },
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  });
  const rejected = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/discover",
  );
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  expect((await rejected).status()).toBeGreaterThanOrEqual(400);
  expect(
    await db.follow.count({
      where: { followerId: follower.id, targetId: target.id },
    }),
  ).toBe(0);
  await page.unroute("**/discover**");
  await page.goto(url);
  await page.route("**/discover**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch({
      headers: { ...route.request().headers(), cookie: "" },
      maxRedirects: 0,
    });
    expect(response.headers()["x-action-redirect"]).toContain("/login");
    await route.fulfill({ response });
  });
  const noSession = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/discover",
  );
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await noSession;
  expect(
    await db.follow.count({
      where: { followerId: follower.id, targetId: target.id },
    }),
  ).toBe(0);
  await page.close();
});
