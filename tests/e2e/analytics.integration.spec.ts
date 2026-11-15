import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { setAnalyticsPreference } from "../../src/lib/analytics/preferences";
import {
  issueClaim,
  consumeClaim,
  disconnectOwner,
} from "../../src/lib/claims";
import {
  collector,
  mockEvents,
  mockRequests,
  setMockFailure,
} from "./analytics-mock";
import { login, logout, password } from "./helpers";
import { postPublicMessage } from "../../src/lib/public-room";
import { postMessage } from "../../src/lib/messages";
import { createRoom } from "../../src/lib/rooms";
import { setFollowing } from "../../src/lib/discovery";
import {
  getDirectRequestContext,
  requestDirectConversation,
  respondToDirectRequest,
  postDirectMessage,
} from "../../src/lib/direct-messages";
import {
  createTopic,
  createDiscussion,
  postDiscussionMessage,
} from "../../src/lib/topics";
import {
  saveRoutineReport,
  recordRoutineCheck,
} from "../../src/lib/agent-routine";
import { setParticipationPaused } from "../../src/lib/participation";
import {
  analyticsOperation,
  analyticsTransaction,
  flushMockAnalytics,
  shutdownMockAnalytics,
} from "../../src/lib/analytics/server";
import { updateTourPreference } from "../../src/lib/tour-preferences";
import { createRecoveryCodes, recoverAccount } from "../../src/lib/recovery";
test.beforeAll(async () => {
  await new Promise<void>((resolve) =>
    collector.listen(3150, "127.0.0.1", resolve),
  );
});
test.afterAll(async () => {
  await shutdownMockAnalytics();
  collector.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    collector.close((e) => (e ? reject(e) : resolve())),
  );
  await db.$disconnect();
});
test("new public posts emit once after commit and redact bodies, handles and retry keys", async ({
  page,
}) => {
  const a = await seed("OWNER", true),
    b = await seed();
  const parent = await postPublicMessage(b.id, {
    body: "SECRET_PARENT",
    clientMessageId: randomUUID(),
  });
  const input = {
    body: "SECRET_MESSAGE",
    clientMessageId: randomUUID(),
    replyToId: parent.id,
  };
  const message = await postPublicMessage(a.id, input);
  expect((await postPublicMessage(a.id, input)).id).toBe(message.id);
  await expect(
    postPublicMessage(a.id, { ...input, body: "changed" }),
  ).rejects.toThrow();
  await flushMockAnalytics();
  await expect
    .poll(() => mockEvents.filter((e) => e.event === "message_posted").length)
    .toBe(1);
  expect(
    mockEvents.find((e) => e.event === "message_posted")?.properties,
  ).toMatchObject({
    conversation_kind: "public",
    is_reply_to_other: true,
    account_type: "person",
  });
  const serialized = JSON.stringify(mockEvents);
  for (const secret of [
    input.body,
    input.clientMessageId,
    a.handle,
    a.id,
    b.id,
  ])
    expect(serialized).not.toContain(secret);
  await login(page, a.handle);
  await page.goto("/public-room");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("SECRET_HTTP_MESSAGE");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect
    .poll(() => mockEvents.filter((e) => e.event === "message_posted").length)
    .toBe(2);
  expect(JSON.stringify(mockEvents)).not.toContain("SECRET_HTTP_MESSAGE");
});
test("follows count actual transitions and retain later legitimate follows", async () => {
  const a = await seed("OWNER", true),
    b = await seed("AGENT");
  await Promise.all([
    setFollowing(a.id, b.id, true),
    setFollowing(a.id, b.id, true),
    setFollowing(a.id, b.id, true),
  ]);
  await flushMockAnalytics();
  expect(mockEvents.filter((e) => e.event === "follow_changed")).toHaveLength(
    1,
  );
  await setFollowing(a.id, b.id, false);
  await setFollowing(a.id, b.id, false);
  await flushMockAnalytics();
  await setFollowing(a.id, b.id, true);
  await flushMockAnalytics();
  const changes = mockEvents.filter((e) => e.event === "follow_changed");
  expect(changes.map((e) => e.properties?.following)).toEqual([
    true,
    false,
    true,
  ]);
  expect(new Set(changes.map((e) => e.uuid)).size).toBe(3);
  expect(JSON.stringify(changes)).not.toContain(b.id);
});
test("direct requests, acceptance and messages keep sender and recipient identities separate", async () => {
  const a = await seed("OWNER", true),
    b = await seed("OWNER", true);
  const context = await getDirectRequestContext(a.id, b.id);
  const intro = {
    body: "SECRET_INTRO",
    clientMessageId: randomUUID(),
    visibilityConfirmed: true,
    visibilityToken: context.visibilityToken,
  };
  const conversation = await requestDirectConversation(a.id, b.id, intro);
  await requestDirectConversation(a.id, b.id, intro);
  const recipient = await getDirectRequestContext(b.id, a.id);
  const decision = {
    decision: "accept",
    requestVersion: conversation.requestVersion,
    visibilityConfirmed: true,
    visibilityToken: recipient.visibilityToken,
  };
  await respondToDirectRequest(b.id, conversation.id, decision);
  await respondToDirectRequest(b.id, conversation.id, decision);
  const input = { body: "SECRET_DIRECT", clientMessageId: randomUUID() };
  await postDirectMessage(b.id, conversation.id, input);
  await postDirectMessage(b.id, conversation.id, input);
  await flushMockAnalytics();
  for (const name of [
    "direct_request_created",
    "direct_request_accepted",
    "message_posted",
  ])
    expect(mockEvents.filter((e) => e.event === name)).toHaveLength(1);
  const id = (event: string) => {
    const e = mockEvents.find((e) => e.event === event)!;
    return e.distinct_id ?? e.properties?.distinct_id;
  };
  expect(id("direct_request_created")).toBe(a.analyticsPreference!.analyticsId);
  expect(id("direct_request_accepted")).toBe(
    b.analyticsPreference!.analyticsId,
  );
  expect(id("message_posted")).toBe(b.analyticsPreference!.analyticsId);
  expect(JSON.stringify(mockEvents)).not.toMatch(
    /SECRET_|visibilityToken|visibilityConfirmed/,
  );
});
test("topic and discussion retries do not inflate contributions", async () => {
  const person = await seed("OWNER", true);
  const input = {
    name: `SECRET_TOPIC_${randomUUID().slice(0, 8)}`,
    description: "SECRET_DESCRIPTION",
    rules: "SECRET_RULES",
    clientCreationId: randomUUID(),
  };
  const topic = await createTopic(person.id, input);
  await createTopic(person.id, input);
  const opening = {
    title: "SECRET_TITLE",
    body: "SECRET_OPENING",
    clientCreationId: randomUUID(),
  };
  const discussion = await createDiscussion(person.id, topic.id, opening);
  await createDiscussion(person.id, topic.id, opening);
  const reply = { body: "SECRET_DISCUSSION", clientMessageId: randomUUID() };
  await postDiscussionMessage(person.id, topic.id, discussion.id, reply);
  await postDiscussionMessage(person.id, topic.id, discussion.id, reply);
  await flushMockAnalytics();
  expect(mockEvents.filter((e) => e.event === "topic_created")).toHaveLength(1);
  expect(
    mockEvents.filter((e) => e.event === "discussion_created"),
  ).toHaveLength(1);
  expect(mockEvents.filter((e) => e.event === "message_posted")).toHaveLength(
    2,
  );
  expect(JSON.stringify(mockEvents)).not.toMatch(/SECRET_/);
  expect(JSON.stringify(mockEvents)).not.toContain(topic.id);
  expect(JSON.stringify(mockEvents)).not.toContain(discussion.id);
});
test("agent contributions, self-reports and owner observations retain the real actor", async ({
  page,
}) => {
  const owner = await seed("OWNER", true),
    agent = await seed("AGENT");
  await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
  await setAnalyticsPreference(owner.id, true, agent.agent!.id);
  const room = await createRoom(agent.id, "SECRET_ROOM");
  const input = { body: "SECRET_PRIVATE", clientMessageId: randomUUID() };
  await postMessage(room.id, agent.id, input);
  await postMessage(room.id, agent.id, input);
  const report = {
    host: "MUSE",
    status: "REPORTED_READY",
    intervalMinutes: 30,
    taskReference: "SECRET_HOST_TASK",
  };
  await saveRoutineReport(agent.id, report);
  await saveRoutineReport(agent.id, report);
  await recordRoutineCheck(agent.id);
  await expect(recordRoutineCheck(owner.id)).rejects.toThrow();
  await setParticipationPaused(owner.id, agent.agent!.id, true);
  await setParticipationPaused(owner.id, agent.agent!.id, true);
  await expect(
    postMessage(room.id, agent.id, {
      body: "denied",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toThrow();
  await flushMockAnalytics();
  for (const name of [
    "agent_connection_created",
    "message_posted",
    "routine_status_changed",
    "agent_checkin_recorded",
    "participation_changed",
  ])
    expect(mockEvents.filter((e) => e.event === name)).toHaveLength(1);
  const ownId = owner.analyticsPreference!.analyticsId;
  for (const name of ["agent_connection_created", "participation_changed"]) {
    const e = mockEvents.find((e) => e.event === name)!;
    expect(e.distinct_id ?? e.properties?.distinct_id).toBe(ownId);
  }
  for (const name of [
    "message_posted",
    "routine_status_changed",
    "agent_checkin_recorded",
  ]) {
    const e = mockEvents.find((e) => e.event === name)!;
    expect(e.properties?.account_type).toBe("agent");
    expect(e.distinct_id ?? e.properties?.distinct_id).not.toBe(ownId);
  }
  await login(page, owner.handle);
  await page.goto(`/rooms/${room.id}`);
  await expect
    .poll(
      () =>
        mockEvents.filter((e) => e.event === "agent_activity_viewed").length,
    )
    .toBe(1);
  const observed = mockEvents.find((e) => e.event === "agent_activity_viewed")!;
  expect(observed.properties).toMatchObject({
    distinct_id: ownId,
    conversation_kind: "private",
    account_type: "person",
  });
  expect(JSON.stringify(mockEvents)).not.toMatch(/SECRET_|autonomous/);
});
test("rollbacks, withdrawn consent, kill switch and collector failures never change domain results", async () => {
  const person = await seed("OWNER", true),
    target = await seed();
  await expect(
    analyticsTransaction(person.id, async (tx, record) => {
      await tx.follow.create({
        data: { followerId: person.id, targetId: target.id },
      });
      record("follow_changed", { following: true, target_type: "person" });
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  await flushMockAnalytics();
  expect(mockEvents).toHaveLength(0);
  expect(
    await db.follow.count({
      where: { followerId: person.id, targetId: target.id },
    }),
  ).toBe(0);
  await analyticsOperation(person.id, async (record) => {
    record("profile_updated", { has_introduction: true, has_interests: false });
    await setAnalyticsPreference(person.id, false);
    await setAnalyticsPreference(person.id, true);
  });
  await flushMockAnalytics();
  expect(mockEvents).toHaveLength(0);
  const enabled = process.env.POSTHOG_ENABLED;
  try {
    process.env.POSTHOG_ENABLED = "false";
    await postPublicMessage(person.id, {
      body: "disabled",
      clientMessageId: randomUUID(),
    });
    await flushMockAnalytics();
    expect(mockEvents).toHaveLength(0);
  } finally {
    process.env.POSTHOG_ENABLED = enabled;
  }
  setMockFailure(true);
  const consoleError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    const saved = await postPublicMessage(person.id, {
      body: "saved during outage",
      clientMessageId: randomUUID(),
    });
    await flushMockAnalytics();
    expect(
      await db.publicMessage.findUnique({ where: { id: saved.id } }),
    ).not.toBeNull();
  } finally {
    console.error = consoleError;
  }
  expect(logged).toHaveLength(0);
  setMockFailure(false);
  await postPublicMessage(person.id, {
    body: "after outage",
    clientMessageId: randomUUID(),
  });
  await flushMockAnalytics();
  expect(mockEvents.filter((e) => e.event === "message_posted")).toHaveLength(
    1,
  );
});
test("tour outcomes are transition-based and replay retry IDs stay stable", async () => {
  const person = await seed("OWNER", true);
  const attempt = { id: randomUUID(), timestamp: Date.now() };
  await updateTourPreference(person.id, "start", attempt);
  await updateTourPreference(person.id, "start", attempt);
  await updateTourPreference(person.id, "complete");
  await updateTourPreference(person.id, "complete");
  await updateTourPreference(person.id, "skip");
  await flushMockAnalytics();
  const starts = mockEvents.filter((e) => e.event === "tour_started");
  expect(starts).toHaveLength(2);
  expect(starts[0].uuid).toBe(starts[1].uuid);
  expect(starts[0].timestamp).toBe(starts[1].timestamp);
  expect(mockEvents.filter((e) => e.event === "tour_completed")).toHaveLength(
    1,
  );
  expect(mockEvents.filter((e) => e.event === "tour_skipped")).toHaveLength(0);
});
test("failed consent saves retain the choice and can be retried", async ({
  page,
}) => {
  const person = await seed("OWNER", true);
  await login(page, person.handle);
  await page.goto("/settings");
  const controls = page.getByRole("region", {
    name: "Usage analytics",
    exact: true,
  });
  await controls.getByRole("checkbox").uncheck();
  await page.route(
    "**/settings",
    (route) =>
      route.request().method() === "POST"
        ? route.abort("failed")
        : route.continue(),
    { times: 1 },
  );
  await controls
    .getByRole("button", { name: "Save analytics preference" })
    .click();
  await expect(controls.getByRole("alert")).toContainText("not saved");
  await expect(controls.getByRole("checkbox")).not.toBeChecked();
  expect(
    (
      await db.analyticsPreference.findUniqueOrThrow({
        where: { accountId: person.id },
      })
    ).enabled,
  ).toBe(true);
  await controls
    .getByRole("button", { name: "Save analytics preference" })
    .click();
  await expect(controls.getByRole("status")).toContainText("saved");
  expect(
    (
      await db.analyticsPreference.findUniqueOrThrow({
        where: { accountId: person.id },
      })
    ).enabled,
  ).toBe(false);
});
test("human registration opt-in is atomic and an agent cannot self-authorize at signup", async ({
  page,
}) => {
  const human = `opt_person_${randomUUID().slice(0, 8)}`;
  const agent = `opt_agent_${randomUUID().slice(0, 8)}`;
  await page.goto("/register");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("SECRET_SIGNUP_NAME");
  await page.getByLabel("Handle", { exact: true }).fill(human);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator('input[name="analyticsOptIn"]').check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard/);
  const person = await db.account.findUniqueOrThrow({
    where: { handle: human },
    include: { analyticsPreference: true },
  });
  expect(person.analyticsPreference?.enabled).toBe(true);
  await expect
    .poll(
      () => mockEvents.filter((e) => e.event === "account_registered").length,
    )
    .toBe(1);
  await logout(page);
  await page.goto("/register");
  await page.locator('input[name="type"][value="AGENT"]').check();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("SECRET_AGENT_NAME");
  await page.getByLabel("Handle", { exact: true }).fill(agent);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.locator("form").evaluate((form) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "analyticsOptIn";
    input.value = "on";
    form.append(input);
  });
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard/);
  const registered = await db.account.findUniqueOrThrow({
    where: { handle: agent },
    include: { analyticsPreference: true },
  });
  expect(registered.analyticsPreference).toBeNull();
  expect(
    await (await page.request.get("/api/analytics/eligibility")).json(),
  ).toBeNull();
  expect(
    mockEvents.filter((e) => e.event === "account_registered"),
  ).toHaveLength(1);
  expect(JSON.stringify(mockEvents)).not.toMatch(
    /SECRET_SIGNUP_NAME|SECRET_AGENT_NAME/,
  );
});
test("analytics preferences reject cross-site writes and recovered sessions lose eligibility", async ({
  page,
}) => {
  const person = await seed("OWNER", true);
  await login(page, person.handle);
  await expect
    .poll(() => mockEvents.filter((e) => e.event === "page_viewed").length)
    .toBeGreaterThan(0);
  await page.goto("/settings");
  const control = page.getByRole("region", {
    name: "Usage analytics",
    exact: true,
  });
  await control.getByRole("checkbox").uncheck();
  await page.route("**/settings", async (route) => {
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
      new URL(r.url()).pathname === "/settings",
  );
  await control
    .getByRole("button", { name: "Save analytics preference" })
    .click();
  expect((await rejected).status()).toBeGreaterThanOrEqual(400);
  expect(
    (
      await db.analyticsPreference.findUniqueOrThrow({
        where: { accountId: person.id },
      })
    ).enabled,
  ).toBe(true);
  await page.unroute("**/settings");
  const codes = await createRecoveryCodes(person.id, password);
  await recoverAccount(
    person.handle,
    codes[0],
    "NewOnlyForLocalTests_42!",
    "analytics-recovery-fixture",
  );
  const eligibility = await page.request.get("/api/analytics/eligibility");
  expect(eligibility.status()).toBe(401);
  expect(await eligibility.json()).toBeNull();
  const count = mockEvents.filter((e) => e.event === "page_viewed").length;
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  expect(mockEvents.filter((e) => e.event === "page_viewed").length).toBe(
    count,
  );
});
test("saved profile changes emit booleans once without profile text", async ({
  page,
}) => {
  const person = await seed("OWNER", true);
  await login(page, person.handle);
  await page.goto("/profile?edit=1");
  const editor = page.locator(".owner-profile-editor");
  await editor.getByLabel("About you", { exact: true }).fill("SECRET_NEW_BIO");
  await editor
    .getByLabel("Interests", { exact: true })
    .fill("SECRET_NEW_INTERESTS");
  await editor
    .getByRole("button", { name: "Save profile", exact: true })
    .click();
  await expect
    .poll(() => mockEvents.filter((e) => e.event === "profile_updated").length)
    .toBe(1);
  const event = mockEvents.find((e) => e.event === "profile_updated")!;
  expect(event.properties).toMatchObject({
    has_introduction: true,
    has_interests: true,
    $geoip_disable: true,
  });
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/profile",
  );
  await editor
    .getByRole("button", { name: "Save profile", exact: true })
    .click();
  await response;
  expect(mockEvents.filter((e) => e.event === "profile_updated")).toHaveLength(
    1,
  );
  expect(JSON.stringify(mockEvents)).not.toMatch(
    /SECRET_NEW_|SECRET_BIO|PRIVATE_PROFILE_TEXT/,
  );
});
test("optional analytics timestamps cannot block a tutorial preference", async ({
  page,
}) => {
  const person = await seed("OWNER", true);
  await login(page, person.handle);
  await page.goto("/settings");
  await page.route("**/settings", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postData() ?? "";
    const response = await route.fetch({
      postData: body.replace(/"timestamp":\d+/, '"timestamp":0'),
    });
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Replay tour", exact: true }).click();
  await expect
    .poll(() =>
      db.accountTourPreference.count({
        where: { accountId: person.id, status: "OFFERED" },
      }),
    )
    .toBe(1);
  await expect(page.locator(".tour-save-notice")).toHaveCount(0);
});
test.beforeEach(() => {
  mockEvents.length = 0;
  mockRequests.length = 0;
  setMockFailure(false);
});
async function seed(type: "OWNER" | "AGENT" = "OWNER", enabled = false) {
  return db.account.create({
    data: {
      handle: `analytic_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      passwordHash: await hash(password),
      type,
      ...(type === "OWNER"
        ? {
            owner: {
              create: {
                displayName: "PRIVATE_PROFILE_TEXT",
                bio: "SECRET_BIO",
              },
            },
          }
        : { agent: { create: { displayName: "Agent" } } }),
      ...(enabled
        ? { analyticsPreference: { create: { enabled: true } } }
        : {}),
    },
    include: { agent: true, owner: true, analyticsPreference: true },
  });
}
test("opt-in is optional, sensitive screens stay quiet and page payloads exclude text and URLs", async ({
  page,
}) => {
  const person = await seed();
  await login(page, person.handle);
  await page.goto("/settings");
  const settings = page.getByRole("region", {
    name: "Usage analytics",
    exact: true,
  });
  await expect(settings.getByRole("checkbox")).not.toBeChecked();
  expect(mockRequests).toHaveLength(0);
  await settings.getByRole("checkbox").check();
  await settings
    .getByRole("button", { name: "Save analytics preference" })
    .click();
  await expect(settings.getByRole("status")).toContainText("saved");
  expect(mockRequests).toHaveLength(0);
  await page.goto(
    "/profiles/" + person.handle + "?SECRET_QUERY=SECRET_QUERY#SECRET_FRAGMENT",
  );
  await expect
    .poll(() => mockEvents.filter((e) => e.event === "page_viewed").length)
    .toBe(1);
  const event = mockEvents.find((e) => e.event === "page_viewed")!;
  expect(event.properties).toMatchObject({
    page_name: "profile",
    account_type: "person",
    capture_source: "browser",
  });
  const all = JSON.stringify(mockEvents);
  expect(all).not.toMatch(
    /SECRET_|PRIVATE_PROFILE_TEXT|\$current_url|\$initial_|referrer/,
  );
  expect(all).not.toContain(person.handle);
  expect(
    mockRequests.every((url) => !/flags|replay|record|survey/.test(url)),
  ).toBe(true);
  const before = mockEvents.length;
  await page.goto("/settings");
  await page.goto("/recover");
  expect(mockEvents.length).toBe(before);
});
test("withdrawal stops collection in another tab and logout does not leak identity into a new account", async ({
  page,
  context,
}) => {
  const a = await seed("OWNER", true);
  const b = await seed("OWNER", true);
  await login(page, a.handle);
  await expect
    .poll(() => mockEvents.filter((e) => e.event === "page_viewed").length)
    .toBeGreaterThan(0);
  const settings = await context.newPage();
  await settings.goto("/settings");
  const control = settings.getByRole("region", {
    name: "Usage analytics",
    exact: true,
  });
  await control.getByRole("checkbox").uncheck();
  await control
    .getByRole("button", { name: "Save analytics preference" })
    .click();
  await expect(control.getByRole("status")).toContainText("saved");
  const before = mockEvents.filter((e) => e.event === "page_viewed").length;
  await page.goto("/discover");
  await expect
    .poll(async () =>
      (await page.request.get("/api/analytics/eligibility")).json(),
    )
    .toBeNull();
  expect(mockEvents.filter((e) => e.event === "page_viewed").length).toBe(
    before,
  );
  await logout(page);
  await login(page, b.handle);
  await expect
    .poll(() =>
      mockEvents.some(
        (e) => e.properties?.distinct_id === b.analyticsPreference!.analyticsId,
      ),
    )
    .toBe(true);
  for (const event of mockEvents.filter((e) => e.event === "$identify"))
    expect(event.properties?.$anon_distinct_id).toBe(
      event.properties?.distinct_id,
    );
  await settings.close();
});
test("owner authorization is per agent and disconnect/reclaim never restores an old opt-in", async ({
  page,
  browser,
}) => {
  const owner = await seed();
  const agent = await seed("AGENT");
  await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
  await login(page, owner.handle);
  await page.goto("/agents");
  const controls = page.getByRole("region", {
    name: "Agent usage analytics",
    exact: true,
  });
  await controls.getByRole("checkbox").check();
  await controls
    .getByRole("button", { name: "Save analytics preference" })
    .click();
  await expect(controls.getByRole("status")).toContainText("saved");
  expect(
    await db.analyticsPreference.count({
      where: { accountId: owner.id, enabled: true },
    }),
  ).toBe(0);
  const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
  try {
    const agentPage = await ctx.newPage();
    await login(agentPage, agent.handle);
    const response = await agentPage.request.get("/api/analytics/eligibility");
    expect(await response.json()).toMatchObject({ accountType: "agent" });
    await agentPage.goto("/settings");
    const own = agentPage.getByRole("region", {
      name: "Usage analytics",
      exact: true,
    });
    await own.getByRole("checkbox").uncheck();
    await own
      .getByRole("button", { name: "Save analytics preference" })
      .click();
    await expect(own.getByRole("status")).toContainText("saved");
    await expect(own.getByRole("checkbox")).toBeDisabled();
    await setAnalyticsPreference(owner.id, true, agent.agent!.id);
    await disconnectOwner(owner.id, agent.agent!.id);
    await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
    expect(
      await (await agentPage.request.get("/api/analytics/eligibility")).json(),
    ).toBeNull();
  } finally {
    await ctx.close();
  }
});
