import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { db } from "../../src/lib/db";
import {
  createDiscussion,
  postDiscussionMessage,
  readDiscussion,
  setTopicFollow,
  setDiscussionFollow,
} from "../../src/lib/topics";
import {
  getAttention,
  getInbox,
  markConversationRead,
} from "../../src/lib/inbox";
import { setConversationPreference } from "../../src/lib/conversation-preferences";
import { reportMessage } from "../../src/lib/reports";
import { setBlocked } from "../../src/lib/blocks";
import { setParticipationPaused } from "../../src/lib/participation";
import { safeNext } from "../../src/lib/validation";
import { discussionPath } from "../../src/lib/discussion-path";
import { login, password } from "./helpers";

test.describe.configure({ timeout: 90_000 });
const run = promisify(execFile);
let sequence = 0;
const suffix = () => `${Date.now().toString(36)}_${sequence++}`;
async function seed(type: "OWNER" | "AGENT" = "OWNER") {
  const handle = `tui_${suffix()}`;
  return db.account.create({
    data: {
      handle,
      type,
      passwordHash: await hash(password),
      ...(type === "AGENT"
        ? { agent: { create: { displayName: handle } } }
        : { owner: { create: { displayName: handle } } }),
    },
    include: { agent: true },
  });
}
async function topic() {
  return db.topic.create({
    data: {
      slug: `trial-${suffix().replaceAll("_", "-")}`,
      name: `Making things together ${suffix()}`,
      description: "A local test topic for building useful things.",
      rules: "Stay curious. Respect privacy.",
    },
  });
}
const input = (body = "An opening with enough context") => ({
  title: `A useful question ${suffix()}`,
  body,
  clientCreationId: randomUUID(),
});
const message = (body: string, replyToId?: number) => ({
  body,
  replyToId,
  clientMessageId: randomUUID(),
});
async function moderate(command: string, id: string) {
  await run(
    process.execPath,
    [
      "scripts/moderate-topics.mjs",
      command,
      "--id",
      id,
      "--operator",
      "local-s6-test",
      "--reason",
      "Disposable moderation check",
    ],
    { env: process.env },
  );
}
test.afterAll(() => db.$disconnect());

test("Public chat to topic to discussion to reply returns through Messages with account-scoped reads", async ({
  page,
  browser,
}) => {
  const a = await seed(),
    b = await seed("AGENT"),
    t = await topic();
  await login(page, a.handle);
  await page.goto("/public-room");
  await page.getByRole("link", { name: "Browse topics", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Find a discussion worth joining.",
      exact: true,
    }),
  ).toBeVisible();
  // The S5 pagination fixtures precede this new topic; walk the bounded list.
  for (
    let i = 0;
    i < 10 &&
    !(await page.getByRole("heading", { name: t.name, exact: true }).count());
    i++
  ) {
    const next = page.getByRole("link", { name: "Next topics", exact: true });
    const href = await next.getAttribute("href");
    await next.click();
    await expect(page).toHaveURL(href!);
  }
  await page
    .getByRole("heading", { name: t.name, exact: true })
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(`/topics/${t.slug}`);
  await expect(
    page.getByRole("heading", { name: t.name, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Follow topic", exact: true }).click();
  await expect(
    page.getByText("Topic saved in your followed topics."),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Start discussion", exact: true })
    .click();
  await expect(page.getByText(/You’ll follow this discussion/)).toBeVisible();
  const title = `How could we build this ${suffix()}?`;
  await page.getByLabel("Discussion title", { exact: true }).fill(title);
  await page
    .getByLabel("Opening contribution", { exact: true })
    .fill("A practical idea to explore.");
  await page
    .getByRole("button", { name: "Start discussion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  const thread = await db.discussionThread.findFirstOrThrow({
    where: { title },
    include: { messages: true },
  });
  const path = discussionPath(t.slug, thread.id);
  expect(
    await db.discussionMessage.count({ where: { threadId: thread.id } }),
  ).toBe(1);
  await expect(
    page.getByRole("checkbox", {
      name: "Follow discussion updates in Messages",
      exact: true,
    }),
  ).toBeChecked();
  const other = await browser.newPage();
  await login(other, b.handle);
  await other.goto(path);
  await other
    .getByRole("button", {
      name: `Reply to message ${thread.messages[0].id}`,
      exact: true,
    })
    .click();
  await other
    .getByLabel("Your message", { exact: true })
    .fill(`A useful response @${a.handle}`);
  await other
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(other.getByRole("log")).toContainText("A useful response");
  const reply = await db.discussionMessage.findFirstOrThrow({
    where: { threadId: thread.id, senderAccountId: b.id },
  });
  expect(reply.replyToId).toBe(thread.messages[0].id);
  expect(
    (await getAttention(a.id)).filter((x) => x.href.includes(thread.id)),
  ).toHaveLength(1);
  await page.goto("/inbox?view=updates");
  await page
    .getByRole("region", { name: "Replies, mentions and updates" })
    .getByRole("link", { name: /A useful response/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`messageId=${reply.id}`));
  await expect(page.locator(`#message-${reply.id}`)).toBeVisible();
  await page
    .getByRole("button", { name: "Mark conversation read", exact: true })
    .click();
  await expect(
    page.getByText("Reading position saved for your account."),
  ).toBeVisible();
  expect(
    (await getAttention(a.id)).some((x) => x.href.includes(thread.id)),
  ).toBe(false);
  expect(
    await db.readPosition.findUnique({
      where: {
        accountId_conversationKey: {
          accountId: b.id,
          conversationKey: `discussion:${thread.id}`,
        },
      },
    }),
  ).toBeNull();
  await page
    .locator(`#message-${reply.id}`)
    .getByRole("link", { name: `View @${b.handle}'s profile`, exact: true })
    .click();
  await expect(page).toHaveURL(`/profiles/${b.handle}`);
  await other.close();
});

test("notification sources stay qualified; topic follows, discussion follows, mute and blocks stay distinct", async () => {
  const a = await seed(),
    b = await seed(),
    savedTopicOnly = await seed(),
    t = await topic();
  await setTopicFollow(savedTopicOnly.id, t.id, true);
  const c = await createDiscussion(a.id, t.id, input());
  const opening = (await readDiscussion(a.id, t.id, c.id))!.opening!;
  await setDiscussionFollow(b.id, t.id, c.id, true);
  const sent = message(`Reply and mention @${a.handle}`, opening.id);
  const reply = await postDiscussionMessage(b.id, t.id, c.id, sent);
  await postDiscussionMessage(b.id, t.id, c.id, sent);
  expect(
    (await getAttention(a.id)).filter((x) => x.href.includes(c.id)),
  ).toHaveLength(1);
  expect(
    (await getAttention(savedTopicOnly.id)).filter((x) =>
      x.href.includes(c.id),
    ),
  ).toHaveLength(0);
  expect(
    (await getInbox(savedTopicOnly.id)).filter(
      (x) => x.key === `discussion:${c.id}`,
    ),
  ).toHaveLength(0);
  await setConversationPreference(a.id, `discussion:${c.id}`, true, true);
  expect((await getAttention(a.id)).some((x) => x.href.includes(c.id))).toBe(
    false,
  );
  expect(
    (await getInbox(a.id)).some((x) => x.key === `discussion:${c.id}`),
  ).toBe(false);
  await setConversationPreference(a.id, `discussion:${c.id}`, true, false);
  await setBlocked(a.id, b.id, true);
  expect((await getAttention(a.id)).some((x) => x.href.includes(c.id))).toBe(
    false,
  );
  expect(
    (await readDiscussion(a.id, t.id, c.id))!.messages.some(
      (m) => m.id === reply.id,
    ),
  ).toBe(true);
  const count = await db.discussionMessage.count({ where: { threadId: c.id } });
  await expect(
    postDiscussionMessage(
      b.id,
      t.id,
      c.id,
      message(Array.from({ length: 11 }, (_, i) => `@account_${i}`).join(" ")),
    ),
  ).rejects.toThrow("at most 10");
  expect(await db.discussionMessage.count({ where: { threadId: c.id } })).toBe(
    count,
  );
  const key = `discussion:${c.id}`;
  await markConversationRead(a.id, key, reply.id);
  await markConversationRead(a.id, key, opening.id);
  expect(
    (
      await db.readPosition.findUniqueOrThrow({
        where: {
          accountId_conversationKey: { accountId: a.id, conversationKey: key },
        },
      })
    ).lastMessageId,
  ).toBe(reply.id);
  const foreign = await createDiscussion(b.id, t.id, input());
  const wrongId = (await readDiscussion(b.id, t.id, foreign.id))!.opening!.id;
  await expect(markConversationRead(a.id, key, wrongId)).rejects.toThrow(
    "unavailable",
  );
  await expect(
    reportMessage(
      a.id,
      key,
      wrongId,
      "This identifier belongs to another discussion.",
    ),
  ).rejects.toThrow("unavailable");
  // Overlapping numeric IDs in another source must not resolve through legacy hydration.
  await db.attentionItem.create({
    data: {
      recipientAccountId: savedTopicOnly.id,
      actorAccountId: b.id,
      kind: "MENTION",
      conversationKey: `discussion:${foreign.id}`,
      messageId: reply.id,
      sourceKey: `wrong-scope-${randomUUID()}`,
    },
  });
  expect(
    (await getAttention(savedTopicOnly.id)).some((x) =>
      x.href.includes(foreign.id),
    ),
  ).toBe(false);
});

test("moderation clears cached bodies and selected reply context, suppresses previews and preserves scoped report evidence", async ({
  page,
}) => {
  const a = await seed(),
    b = await seed(),
    t = await topic(),
    c = await createDiscussion(a.id, t.id, input());
  const reply = await postDiscussionMessage(
    b.id,
    t.id,
    c.id,
    message("Content removed by the local moderator"),
  );
  const path = discussionPath(t.slug, c.id);
  await login(page, a.handle);
  await page.goto(path);
  await page
    .getByRole("button", { name: `Reply to message ${reply.id}`, exact: true })
    .click();
  await expect(page.getByText(/Replying to/)).toContainText("Content removed");
  await page
    .getByRole("button", { name: `Report message ${reply.id}`, exact: true })
    .click();
  await page
    .getByLabel("What should be reviewed?", { exact: true })
    .fill("Please review this local fixture message.");
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Report a message" }).getByRole("status"),
  ).toContainText("Report saved for operator review");
  const reported = await db.messageReport.findFirstOrThrow({
    where: {
      reporterAccountId: a.id,
      conversationKey: `discussion:${c.id}`,
      messageId: reply.id,
    },
  });
  await moderate("hide-message", String(reply.id));
  await expect(page.locator(`#message-${reply.id}`)).toContainText(
    "This contribution is unavailable.",
  );
  await expect(page.locator("main")).not.toContainText(
    "Content removed by the local moderator",
  );
  expect(JSON.stringify(await getAttention(a.id))).not.toContain(
    "Content removed by the local moderator",
  );
  expect(JSON.stringify(await getInbox(a.id))).not.toContain(
    "Content removed by the local moderator",
  );
  await expect(
    run(
      process.execPath,
      ["scripts/review-reports.mjs", "--show", reported.id],
      { env: process.env },
    ),
  ).rejects.toThrow();
  const shown = await run(
    process.execPath,
    [
      "scripts/review-reports.mjs",
      "--show",
      reported.id,
      "--operator",
      "local-test-reviewer",
      "--reason",
      "Review the reported fixture",
    ],
    { env: process.env },
  );
  expect(JSON.parse(shown.stdout).message.body).toBe(
    "Content removed by the local moderator",
  );
  expect(
    await db.topicModerationAction.count({
      where: { targetId: String(reply.id), action: "inspect-reported-message" },
    }),
  ).toBe(1);
  await moderate("hide-thread", c.id);
  await expect(
    page.getByRole("heading", { name: "Discussion unavailable.", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(c.id);
  expect(await readDiscussion(a.id, t.id, c.id)).toBeNull();
  await expect(
    markConversationRead(a.id, `discussion:${c.id}`, reply.id),
  ).rejects.toThrow("unavailable");
});

test("locked, archived and paused posting states update while retained history remains readable", async ({
  page,
}) => {
  const a = await seed("AGENT"),
    t = await topic(),
    c = await createDiscussion(a.id, t.id, input());
  await login(page, a.handle);
  await page.goto(discussionPath(t.slug, c.id));
  await expect(page.getByLabel("Your message", { exact: true })).toBeVisible();
  await moderate("lock-thread", c.id);
  await expect(
    page.getByText(
      "Replies are locked by moderation. You can still read this discussion.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveCount(0);
  await moderate("unlock-thread", c.id);
  await expect(page.getByLabel("Your message", { exact: true })).toBeVisible();
  await moderate("archive-topic", t.id);
  await expect(
    page.getByText("This topic is archived. Discussions are read-only."),
  ).toBeVisible();
  await moderate("unarchive-topic", t.id);
  await setParticipationPaused(a.id, a.agent!.id, true);
  await expect(
    page.getByText("Posting is paused.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Opening contribution", exact: true }),
  ).toBeVisible();
});

test("bounded transcript paging retains opening, revalidates hidden older content and keeps deep links scoped", async ({
  page,
  request,
}) => {
  const a = await seed(),
    t = await topic(),
    otherTopic = await topic(),
    c = await createDiscussion(
      a.id,
      t.id,
      input("An opening that stays above paged replies"),
    );
  await db.discussionMessage.createMany({
    data: Array.from({ length: 230 }, (_, i) => ({
      threadId: c.id,
      senderAccountId: a.id,
      body: `Retained discussion reply ${i}`,
      clientMessageId: randomUUID(),
    })),
  });
  await login(page, a.handle);
  const path = discussionPath(t.slug, c.id);
  await page.goto(path);
  await expect(
    page.getByText("An opening that stays above paged replies", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("log").locator("article")).toHaveCount(50);
  for (
    let i = 0;
    i < 5 &&
    (await page
      .getByRole("button", { name: "Load older replies", exact: true })
      .count());
    i++
  ) {
    const loaded = page.waitForResponse(
      (r) => r.url().includes("/messages?before=") && r.ok(),
    );
    await page
      .getByRole("button", { name: "Load older replies", exact: true })
      .click();
    await loaded;
    await expect(
      page.getByRole("button", { name: "Refresh replies", exact: true }),
    ).toBeEnabled();
  }
  expect(
    await page.getByRole("log").locator("article").count(),
  ).toBeLessThanOrEqual(200);
  const first = await db.discussionMessage.findFirstOrThrow({
    where: { threadId: c.id, body: "Retained discussion reply 0" },
  });
  await page
    .getByRole("button", { name: `Reply to message ${first.id}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Latest replies", exact: true })
    .click();
  await expect(page.getByText(/Replying to/)).toContainText(
    "Retained discussion reply 0",
  );
  await moderate("hide-message", String(first.id));
  await expect(page.getByText(/Replying to/)).toHaveCount(0);
  const url = `/api/topics/${t.slug}/discussions/${c.id}/messages`;
  expect((await request.get(url)).status()).toBe(401);
  const result = await page.request.get(`${url}?around=${first.id}`);
  expect(result.status()).toBe(200);
  expect(result.headers()["cache-control"]).toContain("no-store");
  expect((await result.json()).messages.length).toBeLessThanOrEqual(50);
  expect(
    (
      await page.request.get(
        `${url}?visible=${Array.from({ length: 201 }, () => first.id).join(",")}`,
      )
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.get(
        `/api/topics/${otherTopic.slug}/discussions/${c.id}/messages`,
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post(url, { data: message("No JSON write endpoint") })
    ).status(),
  ).toBe(405);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("S7 profile and Home contributions open S6 context and honor explicit reads and moderation", async ({
  page,
}) => {
  const a = await seed(),
    b = await seed("AGENT"),
    t = await topic();
  const c = await createDiscussion(a.id, t.id, input());
  const reply = await postDiscussionMessage(
    b.id,
    t.id,
    c.id,
    message("A public contribution linking the two social journeys."),
  );
  const target = `${discussionPath(t.slug, c.id)}?messageId=${reply.id}#message-${reply.id}`;
  await login(page, a.handle);
  await page.goto(`/profiles/${b.handle}`);
  const contribution = page.locator(`a[href="${target}"]`).first();
  await expect(contribution).toBeVisible();
  await contribution.click();
  await expect(page).toHaveURL(new RegExp(`messageId=${reply.id}`));
  await expect(page.locator(`#message-${reply.id}`)).toContainText(
    "linking the two social journeys",
  );
  await page.goto("/dashboard");
  const returns = page.getByRole("region", {
    name: "Discussions you follow",
    exact: true,
  });
  await returns.locator(`a[href="${target}"]`).click();
  await expect(
    page.getByRole("heading", { name: "Opening contribution", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark conversation read", exact: true })
    .click();
  await expect(
    page.getByText("Reading position saved for your account."),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.locator(`a[href="${target}"]`)).toHaveCount(0);
  await moderate("hide-message", String(reply.id));
  await page.goto(`/profiles/${b.handle}`);
  await expect(page.locator("main")).not.toContainText(
    "A public contribution linking the two social journeys.",
  );
});

test("creation errors retain drafts, Server Actions reject cross-site requests, and sign-in continuation stays internal", async ({
  page,
  request,
  browser,
}) => {
  const a = await seed(),
    t = await topic();
  await login(page, a.handle);
  await page.goto(`/topics/${t.slug}/new`);
  const draft = input();
  await page.getByLabel("Discussion title", { exact: true }).fill(draft.title);
  await page
    .getByLabel("Opening contribution", { exact: true })
    .fill(draft.body);
  await moderate("archive-topic", t.id);
  const submitted = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"],
  );
  await page
    .getByRole("button", { name: "Start discussion", exact: true })
    .click();
  const action = await submitted;
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "archived",
  );
  await expect(
    page.getByLabel("Opening contribution", { exact: true }),
  ).toHaveValue(draft.body);
  await expect(
    page.getByLabel("Discussion title", { exact: true }),
  ).toHaveValue(draft.title);
  const payload = action.postDataBuffer()!;
  const rejected = await page.request.post(action.url(), {
    data: payload,
    headers: {
      "Content-Type": action.headers()["content-type"],
      "Next-Action": action.headers()["next-action"],
      Origin: "https://other.example",
    },
  });
  expect(rejected.status()).toBe(500);
  expect(
    await db.discussionThread.count({ where: { creatorAccountId: a.id } }),
  ).toBe(0);
  const good = `/topics/${t.slug}/discussions/c123456789012345678901234?messageId=1`;
  expect(safeNext(good)).toBe(good);
  expect(safeNext("//elsewhere.example/topics")).toBe("/dashboard");
  const anonymous = await browser.newPage();
  await anonymous.goto(`/topics/${t.slug}/new`);
  await expect(anonymous).toHaveURL(/\/login\?next=/);
  await anonymous.close();
  const previous = process.env.MINGLO_TOPICS_ENABLED;
  process.env.MINGLO_TOPICS_ENABLED = "false";
  try {
    expect(await getAttention(a.id)).toEqual([]);
    await expect(
      setConversationPreference(
        a.id,
        "discussion:c123456789012345678901234",
        true,
        false,
      ),
    ).rejects.toThrow("unavailable");
  } finally {
    process.env.MINGLO_TOPICS_ENABLED = previous;
  }
});
