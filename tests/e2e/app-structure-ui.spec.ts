import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import {
  consumeClaim,
  issueClaim,
  disconnectOwner,
} from "../../src/lib/claims";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
} from "../../src/lib/rooms";
import { removeParticipant } from "../../src/lib/room-controls";
import { safeNext } from "../../src/lib/validation";
import {
  structureAccount as account,
  structureChat as chat,
} from "./app-structure-fixtures";
import {
  checkStructureNavigation,
  expectUnavailablePage,
} from "./app-structure-navigation";
import { login, password } from "./helpers";

test.afterAll(() => db.$disconnect());

async function connect(owner: string, agent: string) {
  await consumeClaim(owner, (await issueClaim(agent)).token);
}

test("safe sign-in continuations retain supported scalar state and reject ambiguity", async () => {
  const a = await account("AGENT");
  const valid = [
    "/agents",
    "/profile",
    "/profile?edit=1",
    `/conversations?agent=${a.agent!.id}`,
    `/inbox?view=chats&archived=1&page=200&agent=${a.agent!.id}`,
    `/inbox?agent=${a.agent!.id}&view=requests`,
    `/inbox?view=updates&agent=${a.agent!.id}`,
    "/inbox?page=0",
    `/topics?followed=1&after=${a.agent!.id}`,
    `/discover?view=topics&followed=1&after=${a.agent!.id}`,
  ];
  for (const url of valid) expect(safeNext(url), url).toBe(url);
  for (const url of [
    "//evil.example/inbox",
    "https://evil.example/inbox",
    "/inbox?view=unknown",
    "/inbox?view=chats&view=requests",
    `/inbox?agent=${a.agent!.id}&agent=${a.agent!.id}`,
    "/inbox?archived=0",
    "/inbox?page=-1",
    "/inbox?page=201",
    "/inbox?page=1.5",
    "/inbox?page=NaN",
    "/inbox?next=//evil.example",
    "/inbox?agent[]=bad",
    "/inbox?agent=bad",
    "/agents?next=evil",
    "/profile?edit=2",
    "/profile?edit=1&edit=1",
    `/conversations?agent=${a.agent!.id}&other=1`,
    "/topics?followed=1&followed=1",
    "/topics?unknown=1",
  ])
    expect(safeNext(url), url).toBe("/dashboard");
});

test("sign-in returns to own profile, management and filtered lists with query state intact", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const viewer = await account(),
    a = await account("AGENT");
  await connect(viewer.id, a.id);
  for (const target of [
    "/agents",
    "/profile?edit=1",
    `/conversations?agent=${a.agent!.id}`,
    `/inbox?view=requests&page=1&agent=${a.agent!.id}`,
    `/inbox?archived=1&agent=${a.agent!.id}`,
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(target);
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(target);
    await page.getByLabel("Handle", { exact: true }).fill(viewer.handle);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(target);
    await context.close();
  }
});

test("My agents cards link to distinct profiles, participation anchors and authorized room/direct filters", async ({
  page,
}) => {
  const viewer = await account(),
    a = await account("AGENT", "Selected connected agent"),
    b = await account("AGENT"),
    peer = await account("AGENT"),
    empty = await account("AGENT");
  for (const agent of [a, b, empty]) await connect(viewer.id, agent.id);
  const created = await createRoom(a.id, "Selected agent created room");
  const admitted = await createRoom(viewer.id, "Owner-created admitted room");
  const unrelated = await createRoom(b.id, "Other agent private room");
  const invited = await createRoom(
    peer.id,
    "Pending invitation must not grant access",
  );
  for (const room of [admitted, invited])
    await inviteAgent(room.creatorAccountId, room.id, a.handle);
  const membership = await db.membership.findUniqueOrThrow({
    where: { roomId_agentId: { roomId: admitted.id, agentId: a.agent!.id } },
  });
  await respondToInvitation(a.id, membership.id, true);
  await login(page, viewer.handle);
  await page.goto("/profile");
  await expect(
    page.getByRole("region", { name: "Your public profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: `Connected agent @${a.handle}` }),
  ).toHaveCount(0);
  await page.goto("/agents");
  const card = page.getByRole("region", {
    name: `Connected agent @${a.handle}`,
    exact: true,
  });
  for (const [label, href] of [
    ["View profile", `/profiles/${a.handle}`],
    ["Manage participation", `/agent-setup#agent-${a.agent!.id}`],
    ["View agent rooms", `/conversations?agent=${a.agent!.id}`],
    ["View direct chats", `/inbox?agent=${a.agent!.id}`],
  ])
    await expect(
      card.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", href);
  await card
    .getByRole("link", { name: "Manage participation", exact: true })
    .click();
  await expect(page.locator(`#agent-${a.agent!.id}`)).toBeVisible();
  // Posting permission changes must refresh My agents, with no browser reload.
  await page
    .locator(`#agent-${a.agent!.id}`)
    .getByRole("button", { name: "Pause Minglo posting", exact: true })
    .click();
  await expect(page.locator(`#agent-${a.agent!.id}`)).toContainText(
    "Posting is paused in Minglo.",
  );
  await page.goto("/agents");
  await expect(card).toContainText("Posting permission: Paused");
  await card
    .getByRole("link", { name: "View agent rooms", exact: true })
    .click();
  const rooms = page.getByRole("region", { name: "Agent rooms", exact: true });
  await expect(rooms).toContainText(created.title);
  await expect(rooms).toContainText(admitted.title);
  await expect(rooms).not.toContainText(unrelated.title);
  await expect(rooms).not.toContainText(invited.title);
  await removeParticipant(viewer.id, admitted.id, a.agent!.id);
  await page.reload();
  await expect(rooms).not.toContainText(admitted.title);
  await page.goto(`/conversations?agent=${empty.agent!.id}`);
  await expect(page.locator(`a[href="/rooms/${created.id}"]`)).toHaveCount(0);
  for (const suffix of [
    "bad",
    peer.agent!.id,
    a.id,
    `${a.agent!.id}&agent=${b.agent!.id}`,
  ])
    await expectUnavailablePage(page, `/conversations?agent=${suffix}`);
  await expectUnavailablePage(page, `/conversations?agent[]=${a.agent!.id}`);
  await disconnectOwner(viewer.id, a.agent!.id);
  await expectUnavailablePage(page, `/conversations?agent=${a.agent!.id}`);
  await page.goto("/conversations");
  await expect(rooms).toContainText(admitted.title); // independent creator access
  await expect(rooms).not.toContainText(created.title);
});

test("Messages filters retain context through views, shared paging and archives with truthful decisions", async ({
  page,
}) => {
  const viewer = await account(),
    a = await account("AGENT", "Selected message agent"),
    b = await account("AGENT"),
    peer = await account();
  await connect(viewer.id, a.id);
  await connect(viewer.id, b.id);
  const incoming = await chat(a.id, viewer.id, "Incoming personal decision");
  const observed = await chat(a.id, peer.id, "Observed outgoing request");
  await chat(viewer.id, b.id, "Outgoing personal stays Chats");
  const archived = await chat(
    a.id,
    (await account()).id,
    "Selected archived history",
    "ACTIVE",
  );
  await db.conversationPreference.create({
    data: {
      accountId: viewer.id,
      conversationKey: `direct:${archived.id}`,
      archivedAt: new Date(Date.now() + 1000),
    },
  });
  for (let i = 0; i < 31; i++)
    await chat(a.id, (await account()).id, `Selected current ${i}`, "ACTIVE");
  await chat(b.id, (await account()).id, "Other agent excluded", "ACTIVE");
  await login(page, viewer.handle);
  await page.goto(`/inbox?agent=${a.agent!.id}`);
  const tabs = page.getByRole("navigation", {
    name: "Messages views",
    exact: true,
  });
  await expect(
    tabs.getByRole("link", { name: "Requests (1)", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Selected message agent");
  await expect(page.locator("main")).not.toContainText("Other agent excluded");
  await expect(page.locator("main")).not.toContainText(
    "Outgoing personal stays Chats",
  );
  const next = page.getByRole("link", { name: "Next page", exact: true });
  const nextUrl = new URL(
    (await next.getAttribute("href"))!,
    "http://localhost",
  );
  expect(nextUrl.searchParams.get("agent")).toBe(a.agent!.id);
  expect(nextUrl.searchParams.get("page")).toBe("1");
  await next.click();
  await expect(
    page.getByRole("link", { name: "Previous page", exact: true }),
  ).toHaveCount(1);
  await expect(next).toHaveCount(0);
  await tabs.getByRole("link", { name: "Requests (1)", exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("view") === "requests" &&
      !url.searchParams.has("page"),
  );
  const personal = page.getByRole("region", {
    name: "Requests you can decide",
    exact: true,
  });
  const observing = page.getByRole("region", {
    name: "Your agents’ requests",
    exact: true,
  });
  await expect(
    personal.locator(`a[href="/messages/${incoming.id}"]`),
  ).toBeVisible();
  await expect(
    observing.locator(`a[href="/messages/${observed.id}"]`),
  ).toBeVisible();
  await expect(observing).toContainText("Read only");
  await tabs.getByRole("link", { name: /^Updates/ }).click();
  expect(new URL(page.url()).searchParams.get("agent")).toBe(a.agent!.id);
  await tabs.getByRole("link", { name: "Chats", exact: true }).click();
  await page
    .getByRole("link", { name: "View archived chats", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.get("agent")).toBe(a.agent!.id);
  await expect(page.locator("main")).toContainText("Selected archived history");
  await page.getByRole("link", { name: "Clear filter", exact: true }).click();
  await expect(page).toHaveURL((url) => !url.searchParams.has("agent"));
  for (const suffix of ["bad", peer.id, `${a.agent!.id}&agent=${b.agent!.id}`])
    await expectUnavailablePage(page, `/inbox?agent=${suffix}`);
  await expectUnavailablePage(page, `/inbox?agent[]=${a.agent!.id}`);
  await disconnectOwner(viewer.id, a.agent!.id);
  await expectUnavailablePage(page, `/inbox?view=updates&agent=${a.agent!.id}`);
  await page.goto("/inbox?view=requests");
  await expect(page.locator("main")).toContainText(
    "Incoming personal decision",
  );
  await expect(page.locator("main")).not.toContainText(
    "Observed outgoing request",
  );
});

for (const role of ["OWNER", "AGENT"] as const) {
  test(`${role} enabled navigation fits long labels at desktop, 360px and 320px in both themes`, async ({
    page,
  }, info) => {
    test.setTimeout(150_000);
    const viewer = await account(
      role,
      "A very long display name that must wrap on a narrow phone",
    );
    await login(page, viewer.handle);
    await checkStructureNavigation(page, role, true, info);
    if (role === "AGENT") {
      await page.goto("/agents");
      await expect(page).toHaveURL("/profile");
      await expectUnavailablePage(page, `/inbox?agent=${viewer.agent!.id}`);
      await expectUnavailablePage(
        page,
        `/conversations?agent=${viewer.agent!.id}`,
      );
    }
  });
}

test("zero-agent Home puts personal decisions before connection guidance without clearing unread state", async ({
  page,
}) => {
  const viewer = await account(),
    peer = await account();
  const incoming = await chat(
    peer.id,
    viewer.id,
    "An older personal introduction waiting for a decision",
  );
  const outgoing = await chat(
    viewer.id,
    (await account()).id,
    "A personal outgoing request waiting for a response",
  );
  await login(page, viewer.handle);
  const requests = page.getByRole("region", {
    name: "Chat requests for you",
    exact: true,
  });
  await expect(
    requests.locator(`a[href="/messages/${incoming.id}"]`),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Your direct chats", exact: true })
      .locator(`a[href="/messages/${outgoing.id}"]`),
  ).toBeVisible();
  const guidance = page.getByRole("heading", {
    name: "Connect your agent",
    exact: true,
  });
  await expect(guidance).toBeVisible();
  const requestsTop = await requests.evaluate(
    (el) => el.getBoundingClientRect().top,
  );
  const guidanceTop = await guidance.evaluate(
    (el) => el.getBoundingClientRect().top,
  );
  expect(requestsTop).toBeLessThan(guidanceTop);
  expect(await db.readPosition.count({ where: { accountId: viewer.id } })).toBe(
    0,
  );
  await page.goto("/inbox?view=requests");
  await expect(
    page
      .getByRole("navigation", { name: "Messages views" })
      .getByRole("link", { name: "Requests (1)", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    "A personal outgoing request waiting",
  );
  expect(await db.readPosition.count({ where: { accountId: viewer.id } })).toBe(
    0,
  );
});

test("Requests decisions count includes the signed-in agent's own room invitations and excludes outgoing requests", async ({
  page,
}) => {
  const viewer = await account("AGENT"),
    creator = await account();
  await chat(
    (await account()).id,
    viewer.id,
    "Incoming personal chat for agent",
  );
  await chat(viewer.id, (await account()).id, "Outgoing agent chat request");
  const room = await createRoom(
    creator.id,
    "Agent's actionable room invitation",
  );
  await inviteAgent(creator.id, room.id, viewer.handle);
  await login(page, viewer.handle);
  await page.goto("/inbox?view=requests");
  await expect(
    page
      .getByRole("navigation", { name: "Messages views" })
      .getByRole("link", { name: "Requests (2)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Pending invitations", exact: true }),
  ).toContainText(room.title);
  await expect(
    page.getByRole("region", { name: "Requests you can decide", exact: true }),
  ).toContainText("Incoming personal chat for agent");
  await expect(page.locator("main")).not.toContainText(
    "Outgoing agent chat request",
  );
});

test("Topics owns all nested active states and legacy discovery preserves validated follow/cursor state", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const viewer = await account();
  const topic = await db.topic.create({
    data: {
      slug: `navigation-${viewer.id}`,
      name: "Navigation topic fixture",
      description: "Standalone Topics navigation",
      rules: "Respect privacy",
    },
  });
  const thread = await db.discussionThread.create({
    data: {
      topicId: topic.id,
      creatorAccountId: viewer.id,
      title: "Navigation discussion fixture",
      clientCreationId: randomUUID(),
      messages: {
        create: {
          senderAccountId: viewer.id,
          body: "A visible opening contribution",
          clientMessageId: randomUUID(),
        },
      },
    },
  });
  await login(page, viewer.handle);
  const nav = page.getByRole("navigation", { name: "Workspace", exact: true });
  for (const route of [
    "/topics",
    "/topics/new",
    `/topics/${topic.slug}`,
    `/topics/${topic.slug}/new`,
    `/topics/${topic.slug}/discussions/${thread.id}`,
  ]) {
    await page.goto(route);
    await expect(
      nav.getByRole("link", { name: "Topics", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: "People & agents", exact: true }),
    ).not.toHaveAttribute("aria-current", "page");
  }
  await page.goto(`/discover?view=topics&followed=1&after=${topic.id}`);
  await expect(page).toHaveURL(`/topics?followed=1&after=${topic.id}`);
  await page.goto(`/discover?view=topics&followed=1&followed=1&after=invalid`);
  await expect(page).toHaveURL("/topics");
});
