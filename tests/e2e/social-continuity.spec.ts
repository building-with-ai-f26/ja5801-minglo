import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import {
  listPublicContributions,
  discussionMessageHref,
} from "../../src/lib/public-contributions";
import { getOwnerExchange } from "../../src/lib/owner-exchange";
import {
  getDiscussionReturns,
  getDirectReturns,
} from "../../src/lib/return-activity";
import { profileForViewer } from "../../src/lib/discovery";
import {
  issueClaim,
  consumeClaim,
  disconnectOwner,
} from "../../src/lib/claims";
import { createRoom } from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import {
  getDirectRequestContext,
  requestDirectConversation,
  respondToDirectRequest,
  postDirectMessage,
} from "../../src/lib/direct-messages";
import {
  createDiscussion,
  postDiscussionMessage,
  setDiscussionFollow,
  setTopicFollow,
} from "../../src/lib/topics";
import { setBlocked } from "../../src/lib/blocks";
import { login, password } from "./helpers";

let sequence = 0;
const unique = () => `${Date.now().toString(36)}${sequence++}`;
const passwordHash = hash(password);
async function account(
  type: "AGENT" | "OWNER" = "AGENT",
  displayName = "Continuity fixture",
) {
  return db.account.create({
    data: {
      handle: `s7_${unique()}`,
      type,
      passwordHash: await passwordHash,
      ...(type === "AGENT"
        ? { agent: { create: { displayName } } }
        : { owner: { create: { displayName } } }),
    },
    include: { agent: true, owner: true },
  });
}
async function topic() {
  return db.topic.create({
    data: {
      slug: `s7-${unique()}`,
      name: "Making things · local fixture",
      description: "Disposable continuity checks",
      rules: "Keep context visible",
    },
  });
}
async function discussion(
  accountId: string,
  topicId: string,
  title = "A place to return",
) {
  return createDiscussion(accountId, topicId, {
    title,
    body: "Opening context",
    clientCreationId: randomUUID(),
  });
}
async function direct(
  sender: string,
  recipient: string,
  body = "Private introduction",
) {
  const review = await getDirectRequestContext(sender, recipient);
  const chat = await requestDirectConversation(sender, recipient, {
    body,
    clientMessageId: randomUUID(),
    visibilityConfirmed: true,
    visibilityToken: review.visibilityToken,
  });
  return chat;
}
async function accept(recipient: string, sender: string, id: string) {
  const review = await getDirectRequestContext(recipient, sender);
  await respondToDirectRequest(recipient, id, {
    decision: "accept",
    requestVersion: 1,
    visibilityConfirmed: true,
    visibilityToken: review.visibilityToken,
  });
}
test.afterAll(() => db.$disconnect());

test("mixed public pages keep equal timestamps and separate ID fences stable during new posts", async () => {
  const author = await account(),
    viewer = await account("OWNER"),
    t = await topic();
  const same = new Date("2026-10-01T12:00:00.000Z");
  const thread = await db.discussionThread.create({
    data: {
      topicId: t.id,
      title: "Stable timestamp fixture",
      creatorAccountId: author.id,
      clientCreationId: randomUUID(),
      messages: {
        create: {
          senderAccountId: author.id,
          body: "Opening context",
          clientMessageId: randomUUID(),
          createdAt: same,
        },
      },
    },
  });
  await db.publicMessage.createMany({
    data: Array.from({ length: 17 }, (_, i) => ({
      senderAccountId: author.id,
      body: `General fixture ${i}`,
      clientMessageId: randomUUID(),
      createdAt: same,
    })),
  });
  await db.discussionMessage.createMany({
    data: Array.from({ length: 16 }, (_, i) => ({
      threadId: thread.id,
      senderAccountId: author.id,
      body: `Discussion fixture ${i}`,
      clientMessageId: randomUUID(),
      createdAt: same,
    })),
  });
  const first = await listPublicContributions(viewer.id, author.id);
  expect(first.items).toHaveLength(10);
  expect(first.next).toBeTruthy();
  // A post can have a tied or earlier time without joining an existing page walk.
  await db.publicMessage.create({
    data: {
      senderAccountId: author.id,
      body: "New General excluded from old snapshot",
      clientMessageId: randomUUID(),
      createdAt: same,
    },
  });
  await db.discussionMessage.create({
    data: {
      threadId: thread.id,
      senderAccountId: author.id,
      body: "New discussion excluded from old snapshot",
      clientMessageId: randomUUID(),
      createdAt: same,
    },
  });
  const all = [...first.items];
  let cursor = first.next;
  while (cursor) {
    const page = await listPublicContributions(viewer.id, author.id, cursor);
    expect(page.items.length).toBeLessThanOrEqual(10);
    all.push(...page.items);
    cursor = page.next;
  }
  expect(all).toHaveLength(34);
  expect(new Set(all.map((m) => `${m.kind}:${m.id}`)).size).toBe(34);
  expect(all.map((m) => m.kind)).toEqual([
    ...Array(17).fill("discussion"),
    ...Array(17).fill("general"),
  ]);
  expect(JSON.stringify(all)).not.toContain("excluded from old snapshot");
  expect(
    (await listPublicContributions(viewer.id, author.id)).items.map(
      (m) => m.body,
    ),
  ).toContain("New discussion excluded from old snapshot");
  expect(
    (await listPublicContributions(viewer.id, viewer.id, first.next!))
      .invalidCursor,
  ).toBe(true);
  for (const value of [
    "!bad",
    "x".repeat(1001),
    Buffer.from('{"id":-1}').toString("base64url"),
  ])
    expect(
      await listPublicContributions(viewer.id, author.id, value),
    ).toMatchObject({ items: [], invalidCursor: true });
});

test("profile projections exclude private/DM bodies and hidden evidence on every page", async () => {
  const author = await account(),
    viewer = await account("OWNER"),
    t = await topic();
  const visible = await discussion(author.id, t.id, "Visible discussion"),
    hidden = await discussion(author.id, t.id, "Hidden title stays private");
  const hiddenMessage = await postDiscussionMessage(
    author.id,
    t.id,
    visible.id,
    { body: "Hidden reply evidence", clientMessageId: randomUUID() },
  );
  await db.discussionMessage.update({
    where: { id: hiddenMessage.id },
    data: { hiddenAt: new Date() },
  });
  await db.discussionThread.update({
    where: { id: hidden.id },
    data: { hiddenAt: new Date() },
  });
  const room = await createRoom(author.id, "Private fixture title");
  await postMessage(room.id, author.id, {
    body: "Private room secret",
    clientMessageId: randomUUID(),
  });
  await direct(
    author.id,
    viewer.id,
    "Direct secret even for an authorized viewer",
  );
  const general = await postPublicMessage(author.id, {
    body: "Visible General contribution",
    clientMessageId: randomUUID(),
  });
  const profile = await profileForViewer(viewer.id, author.handle);
  const encoded = JSON.stringify(profile);
  expect(encoded).toContain("Visible discussion");
  expect(encoded).toContain("Visible General contribution");
  expect(encoded).not.toMatch(
    /Hidden title|Hidden reply|Private room secret|Direct secret|ownerId|passwordHash|participationPaused|routine/,
  );
  expect(profile!.contributions.find((m) => m.kind === "general")!.href).toBe(
    `/public-room?messageId=${general.id}#message-${general.id}`,
  );
  await db.topic.update({
    where: { id: t.id },
    data: { archivedAt: new Date() },
  });
  await db.discussionThread.update({
    where: { id: visible.id },
    data: { lockedAt: new Date() },
  });
  expect(
    JSON.stringify(await listPublicContributions(viewer.id, author.id)),
  ).toContain("Visible discussion");
  await db.discussionThread.update({
    where: { id: visible.id },
    data: { hiddenAt: new Date() },
  });
  expect(
    JSON.stringify(await listPublicContributions(viewer.id, author.id)),
  ).not.toContain("Visible discussion");
  expect(
    (await listPublicContributions("cmissing000000000000000000", author.id))
      .items,
  ).toEqual([]);
});

test("owner exchanges use current DM claims and retain independent participant access after disconnect", async () => {
  const owner = await account("OWNER"),
    nextOwner = await account("OWNER"),
    a = await account(),
    b = await account();
  await consumeClaim(owner.id, (await issueClaim(a.id)).token);
  const chat = await direct(b.id, a.id, "Private parent from another agent");
  await accept(a.id, b.id, chat.id);
  const parent = await db.directMessage.findFirstOrThrow({
    where: { conversationId: chat.id },
  });
  const reply = await postDirectMessage(a.id, chat.id, {
    body: "Agent DM progress",
    replyToId: parent.id,
    clientMessageId: randomUUID(),
  });
  expect(await getOwnerExchange(owner.id)).toMatchObject({
    source: "direct",
    body: "Agent DM progress",
    visibility: expect.stringContaining("Read-only"),
    parent: { body: "Private parent from another agent" },
    href: `/messages/${chat.id}?messageId=${reply.id}#message-${reply.id}`,
  });
  const before = await db.readPosition.findMany({ where: { accountId: a.id } });
  expect(
    (await getDirectReturns(owner.id)).observing.map((c) => c.id),
  ).toContain(chat.id);
  expect(
    await db.readPosition.findMany({ where: { accountId: a.id } }),
  ).toEqual(before);
  await disconnectOwner(owner.id, a.agent!.id);
  expect(await getOwnerExchange(owner.id)).toBeNull();
  expect((await getDirectReturns(owner.id)).observing).toEqual([]);
  await consumeClaim(nextOwner.id, (await issueClaim(a.id)).token);
  expect((await getOwnerExchange(nextOwner.id))!.body).toBe(
    "Agent DM progress",
  );
  const personal = await direct(owner.id, a.id, "Owner posts as own account");
  await disconnectOwner(nextOwner.id, a.agent!.id);
  expect(
    (await getDirectReturns(owner.id)).personal.map((c) => c.id),
  ).toContain(personal.id);
  expect(await getOwnerExchange(owner.id)).toBeNull();
});

test("owner topic exchange omits hidden parents and falls back when its source is hidden", async () => {
  const owner = await account("OWNER"),
    a = await account(),
    other = await account(),
    t = await topic();
  await consumeClaim(owner.id, (await issueClaim(a.id)).token);
  await postPublicMessage(a.id, {
    body: "Safe General fallback",
    clientMessageId: randomUUID(),
  });
  const thread = await discussion(other.id, t.id);
  const parent = await db.discussionMessage.findFirstOrThrow({
    where: { threadId: thread.id },
  });
  const reply = await postDiscussionMessage(a.id, t.id, thread.id, {
    body: "Visible topic progress",
    replyToId: parent.id,
    clientMessageId: randomUUID(),
  });
  expect(await getOwnerExchange(owner.id)).toMatchObject({
    source: "discussion",
    parent: { body: "Opening context" },
    href: discussionMessageHref(t.slug, thread.id, reply.id),
  });
  await db.discussionMessage.update({
    where: { id: parent.id },
    data: { hiddenAt: new Date() },
  });
  expect((await getOwnerExchange(owner.id))!.parent).toBeNull();
  await db.discussionThread.update({
    where: { id: thread.id },
    data: { hiddenAt: new Date() },
  });
  expect(await getOwnerExchange(owner.id)).toMatchObject({
    source: "public",
    body: "Safe General fallback",
  });
});

test("return briefing uses discussion subscriptions, own read positions, mute, blocks and current visibility", async () => {
  const reader = await account(),
    author = await account(),
    owner = await account("OWNER"),
    t = await topic();
  await consumeClaim(owner.id, (await issueClaim(reader.id)).token);
  const thread = await discussion(author.id, t.id);
  await setTopicFollow(reader.id, t.id, true);
  expect(await getDiscussionReturns(reader.id)).toEqual([]);
  await setDiscussionFollow(reader.id, t.id, thread.id, true);
  const reply = await postDiscussionMessage(author.id, t.id, thread.id, {
    body: "An update to return to",
    clientMessageId: randomUUID(),
  });
  expect(await getDiscussionReturns(reader.id)).toMatchObject([
    {
      title: "A place to return",
      source: t.name,
      author: author.handle,
      preview: "An update to return to",
      href: discussionMessageHref(t.slug, thread.id, reply.id),
    },
  ]);
  expect(await getDiscussionReturns(owner.id)).toEqual([]);
  expect(await db.readPosition.count({ where: { accountId: reader.id } })).toBe(
    0,
  );
  await db.conversationPreference.update({
    where: {
      accountId_conversationKey: {
        accountId: reader.id,
        conversationKey: `discussion:${thread.id}`,
      },
    },
    data: { muted: true },
  });
  expect(await getDiscussionReturns(reader.id)).toEqual([]);
  await db.conversationPreference.update({
    where: {
      accountId_conversationKey: {
        accountId: reader.id,
        conversationKey: `discussion:${thread.id}`,
      },
    },
    data: { muted: false },
  });
  await setBlocked(author.id, reader.id, true);
  expect(await getDiscussionReturns(reader.id)).toEqual([]);
  await setBlocked(author.id, reader.id, false);
  await db.readPosition.create({
    data: {
      accountId: reader.id,
      conversationKey: `discussion:${thread.id}`,
      lastMessageId: reply.id,
    },
  });
  expect(await getDiscussionReturns(reader.id)).toEqual([]);
  const fresh = await postDiscussionMessage(author.id, t.id, thread.id, {
    body: "Fresh context",
    clientMessageId: randomUUID(),
  });
  expect((await getDiscussionReturns(reader.id))[0].id).toBe(fresh.id);
  await db.discussionMessage.updateMany({
    where: { threadId: thread.id },
    data: { hiddenAt: new Date() },
  });
  expect(await getDiscussionReturns(reader.id)).toEqual([]);
  await db.discussionMessage.update({
    where: { id: fresh.id },
    data: { hiddenAt: null },
  });
  await db.discussionThread.update({
    where: { id: thread.id },
    data: { hiddenAt: new Date() },
  });
  expect(await getDiscussionReturns(reader.id)).toEqual([]);
});

test("profiles paginate escaped contributions and Home separates personal and observed chat return links", async ({
  page,
}) => {
  const viewer = await account("OWNER", "Returning person"),
    a = await account("AGENT", "Connected author"),
    other = await account("AGENT", "Conversation partner"),
    t = await topic();
  a.handle = `s7_${unique()}`.padEnd(30, "x");
  await db.account.update({ where: { id: a.id }, data: { handle: a.handle } });
  await consumeClaim(viewer.id, (await issueClaim(a.id)).token);
  const thread = await discussion(
    a.id,
    t.id,
    "A long discussion title with useful context for a returning reader",
  );
  const text =
    "<script>window.s7Injected=true</script> Visible words, safely escaped.";
  const reply = await postDiscussionMessage(a.id, t.id, thread.id, {
    body: text,
    clientMessageId: randomUUID(),
  });
  await db.publicMessage.createMany({
    data: Array.from({ length: 13 }, (_, i) => ({
      senderAccountId: a.id,
      body: `A real fixture contribution ${i}`,
      clientMessageId: randomUUID(),
    })),
  });
  const observed = await direct(
    other.id,
    a.id,
    "Observed introduction visible only through a current connection",
  );
  const personal = await direct(
    other.id,
    viewer.id,
    "Personal introduction belongs in your own chats",
  );
  await setDiscussionFollow(viewer.id, t.id, thread.id, true);
  await login(page, viewer.handle);
  await expect(
    page.getByRole("region", { name: "Your direct chats", exact: true }),
  ).toContainText("Personal introduction belongs");
  const observedRegion = page.getByRole("region", {
    name: "Your agents’ direct chats",
    exact: true,
  });
  await expect(observedRegion).toContainText("Read-only");
  await expect(
    observedRegion.getByRole("link", { name: /Conversation partner/ }),
  ).toHaveAttribute("href", `/messages/${observed.id}`);
  await expect(
    page
      .getByRole("region", { name: "Your direct chats", exact: true })
      .getByRole("link", { name: /Conversation partner/ }),
  ).toHaveAttribute("href", `/messages/${personal.id}`);
  await expect(
    page.getByRole("region", { name: "Discussions you follow" }),
  ).toContainText(t.name);
  await expect(
    page
      .getByRole("region", { name: "Discussions you follow" })
      .getByRole("link", { name: /A long discussion title/ }),
  ).toHaveAttribute("href", discussionMessageHref(t.slug, thread.id, reply.id));
  await mkdir(".impeccable/review/s7", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      localStorage.setItem("minglo-theme", t);
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 960 });
      await page.screenshot({
        path: `.impeccable/review/s7/home-${width}-${theme}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.goto(`/profiles/${a.handle}`);
  const contributions = page.getByRole("region", {
    name: "Recent public contributions",
  });
  await expect(contributions.locator("article")).toHaveCount(10);
  await expect(contributions).toContainText("General · Public chat");
  await expect(contributions).not.toContainText("Observed introduction");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      localStorage.setItem("minglo-theme", t);
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 960 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  const accountControls = page.getByRole("region", {
    name: "Account controls",
    exact: true,
  });
  await accountControls.locator("summary").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await accountControls.locator("summary").click();
  const withAuthor = await direct(viewer.id, a.id, "Existing profile request");
  await page.getByRole("link", { name: "Older contributions" }).click();
  await expect(contributions).toContainText(text);
  await expect(
    page.getByRole("link", { name: "View chat request", exact: true }),
  ).toHaveAttribute("href", `/messages/${withAuthor.id}`);
  await expect(contributions).toContainText(t.name);
  await expect(
    contributions
      .getByRole("link", { name: "Open this contribution" })
      .filter({ hasText: "Open this contribution" })
      .first(),
  ).toHaveAttribute("href", /public-room|topics/);
  expect(await page.evaluate(() => Object.hasOwn(window, "s7Injected"))).toBe(
    false,
  );
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      localStorage.setItem("minglo-theme", t);
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 960 });
      await page.screenshot({
        path: `.impeccable/review/s7/profile-${width}-${theme}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.getByRole("link", { name: "Latest contributions" }).click();
  await expect(contributions.locator("article")).toHaveCount(10);
  await page.goto(`/profiles/${a.handle}?contributions=bad`);
  await expect(contributions).toContainText(
    "This contribution page is unavailable",
  );
  await page.getByRole("link", { name: "Latest contributions" }).click();
  await expect(contributions.locator("article")).toHaveCount(10);
  await disconnectOwner(viewer.id, a.agent!.id);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", {
      name: "Your agents’ direct chats",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Observed introduction");
});

test("disabled Topics cannot surface profile, Home or return links before launch", async () => {
  const owner = await account("OWNER"),
    author = await account(),
    t = await topic();
  await consumeClaim(owner.id, (await issueClaim(author.id)).token);
  await postPublicMessage(author.id, {
    body: "General stays available",
    clientMessageId: randomUUID(),
  });
  const thread = await discussion(author.id, t.id, "Unlaunched discussion");
  await setDiscussionFollow(owner.id, t.id, thread.id, true);
  const original = process.env.MINGLO_TOPICS_ENABLED;
  try {
    process.env.MINGLO_TOPICS_ENABLED = "false";
    const profile = await profileForViewer(owner.id, author.handle);
    expect(profile!.contributions.map((m) => m.kind)).toEqual(["general"]);
    expect(await getOwnerExchange(owner.id)).toMatchObject({
      source: "public",
      body: "General stays available",
    });
    expect(await getDiscussionReturns(owner.id)).toEqual([]);
    expect(JSON.stringify(profile)).not.toContain("Unlaunched discussion");
  } finally {
    process.env.MINGLO_TOPICS_ENABLED = original;
  }
});
