import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "../../src/lib/db";
import {
  getDirectRequestContext,
  requestDirectConversation,
  respondToDirectRequest,
  postDirectMessage,
} from "../../src/lib/direct-messages";
import { listDirectChats } from "../../src/lib/direct-views";
import { getAttention, markConversationRead } from "../../src/lib/inbox";
import {
  setConversationPreference,
  archiveDirectConversation,
} from "../../src/lib/conversation-preferences";
import { reportMessage } from "../../src/lib/reports";
import {
  issueClaim,
  consumeClaim,
  disconnectOwner,
} from "../../src/lib/claims";
import { setBlocked } from "../../src/lib/blocks";
import { login, logout, password } from "./helpers";

let index = 0;
async function seed(type: "OWNER" | "AGENT" = "OWNER") {
  const handle = `dui_${Date.now().toString(36)}_${index++}`;
  return db.account.create({
    data: {
      handle,
      type,
      passwordHash: await hash(password),
      ...(type === "OWNER"
        ? { owner: { create: { displayName: handle } } }
        : { agent: { create: { displayName: handle } } }),
    },
    include: { agent: true },
  });
}
async function pending(a: string, b: string, body = "Private introduction") {
  const context = await getDirectRequestContext(a, b);
  return requestDirectConversation(a, b, {
    body,
    clientMessageId: randomUUID(),
    visibilityConfirmed: true,
    visibilityToken: context.visibilityToken,
  });
}
async function active(a: string, b: string) {
  const c = await pending(a, b);
  const context = await getDirectRequestContext(b, a);
  await respondToDirectRequest(b, c.id, {
    decision: "accept",
    requestVersion: c.requestVersion,
    visibilityConfirmed: true,
    visibilityToken: context.visibilityToken,
  });
  return c;
}
test.afterAll(async () => {
  await db.$disconnect();
});

test("profile to request to acceptance to reply retains authorship, explicit reads and deep links", async ({
  page,
  browser,
}) => {
  const a = await seed(),
    b = await seed("AGENT"),
    owner = await seed();
  await consumeClaim(owner.id, (await issueClaim(b.id)).token);
  const recipient = await browser.newPage();
  await login(page, a.handle);
  await page.goto(`/profiles/${b.handle}`);
  await page
    .getByRole("link", { name: `Message @${b.handle}`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Who can read this chat" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Connected owner · read only`, { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(owner.handle) }),
  ).toBeVisible();
  await page
    .getByLabel("Your introduction", { exact: true })
    .fill("Could we talk about our shared interests?");
  const send = page.getByRole("button", {
    name: "Send chat request",
    exact: true,
  });
  await expect(send).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /I understand who can read/ })
    .check();
  const submitted = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"],
  );
  await send.click();
  const actionRequest = await submitted;
  await expect(page).toHaveURL(/\/messages\/c/);
  const id = page.url().split("/").at(-1)!;
  const beforeForgery = await db.directConversation.findUniqueOrThrow({
    where: { id },
    include: { messages: true },
  });
  const forged = await page.request.post(actionRequest.url(), {
    headers: { ...actionRequest.headers(), origin: "https://other.example" },
    data: actionRequest.postDataBuffer()!,
  });
  expect(forged.status()).toBe(500); // Next rejects mismatched Origin/Host before invoking the action.
  // Next exposes the diagnostic in dev and redacts it to a Flight error digest
  // in production. Both builds must reject the request without changing data.
  expect(await forged.text()).toMatch(
    /Invalid Server Actions request|1:E\{"digest":"\d+"\}/,
  );
  expect(
    await db.directConversation.findUniqueOrThrow({
      where: { id },
      include: { messages: true },
    }),
  ).toEqual(beforeForgery);
  await expect(
    page.getByRole("heading", { name: "Chat request sent" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Waiting for the recipient’s decision.", { exact: true }),
  ).toBeVisible();
  await page.goto(`/profiles/${b.handle}`);
  await expect(
    page.getByRole("link", { name: "View chat request", exact: true }),
  ).toHaveAttribute("href", `/messages/${id}`);
  await login(recipient, b.handle);
  await recipient.goto("/inbox");
  await recipient.getByRole("link", { name: /^Requests/ }).click();
  await recipient
    .getByRole("region", { name: "Requests you can decide" })
    .getByRole("link")
    .first()
    .click();
  await expect(
    recipient.getByRole("button", { name: "Accept chat request", exact: true }),
  ).toBeDisabled();
  await expect(
    recipient.getByText("Review the chat request above to accept or decline.", {
      exact: true,
    }),
  ).toBeVisible();
  await recipient
    .getByRole("checkbox", { name: /I understand who can read/ })
    .check();
  await recipient
    .getByRole("button", { name: "Accept chat request", exact: true })
    .click();
  await expect(
    recipient.getByLabel("Your message", { exact: true }),
  ).toBeVisible();
  const introduction = await db.directMessage.findFirstOrThrow({
    where: { conversationId: id },
    orderBy: { id: "asc" },
  });
  await recipient
    .getByRole("button", {
      name: `Reply to message ${introduction.id}`,
      exact: true,
    })
    .click();
  await recipient
    .getByLabel("Your message", { exact: true })
    .fill("Happy to continue this conversation.");
  await recipient
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(recipient.getByRole("log")).toContainText(
    "Happy to continue this conversation.",
  );
  const message = await db.directMessage.findFirstOrThrow({
    where: { conversationId: id, requestVersion: null },
  });
  expect(message.senderAccountId).toBe(b.id);
  expect(message.replyToId).toBe(introduction.id);
  await page.goto("/inbox?view=updates");
  await page
    .getByRole("region", { name: "Replies, mentions and updates" })
    .getByRole("link")
    .filter({ hasText: "Happy to continue" })
    .click();
  await expect(page).toHaveURL(new RegExp(`messageId=${message.id}`));
  expect(
    await db.readPosition.count({
      where: { accountId: a.id, conversationKey: `direct:${id}` },
    }),
  ).toBe(0);
  await page.getByRole("button", { name: "Mark conversation read" }).click();
  await expect
    .poll(async () =>
      (await getAttention(a.id)).some((i) => i.preview === message.body),
    )
    .toBe(false);
  expect(
    await db.readPosition.count({
      where: { accountId: b.id, conversationKey: `direct:${id}` },
    }),
  ).toBe(0);
  await recipient.close();
});

test("reader changes require a new review and preserve the introduction draft", async ({
  page,
}) => {
  const a = await seed(),
    b = await seed("AGENT"),
    owner = await seed();
  await login(page, a.handle);
  await page.goto(`/messages/new/${b.handle}`);
  await page
    .getByLabel("Your introduction", { exact: true })
    .fill("Keep this introduction while readers change.");
  await page
    .getByRole("checkbox", { name: /I understand who can read/ })
    .check();
  await consumeClaim(owner.id, (await issueClaim(b.id)).token);
  await page
    .getByRole("button", { name: "Send chat request", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "readers changed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /I understand who can read/ }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Your introduction", { exact: true }),
  ).toHaveValue("Keep this introduction while readers change.");
  await expect(
    page.getByRole("link", { name: new RegExp(owner.handle) }),
  ).toBeVisible();
  expect(
    await db.directConversation.count({
      where: { requestedByAccountId: a.id },
    }),
  ).toBe(0);
  await page
    .getByRole("checkbox", { name: /I understand who can read/ })
    .check();
  await page
    .getByRole("button", { name: "Send chat request", exact: true })
    .click();
  await expect(page).toHaveURL(/\/messages\/c/);
});

test("connected-owner previews and opt-in updates lose access after disconnect, including open polling", async ({
  page,
}) => {
  const a = await seed("AGENT"),
    b = await seed(),
    owner = await seed(),
    nextOwner = await seed();
  await consumeClaim(owner.id, (await issueClaim(a.id)).token);
  const c = await active(a.id, b.id);
  await postDirectMessage(b.id, c.id, {
    body: "Retained owner-readable history",
    clientMessageId: randomUUID(),
  });
  expect(
    (await getAttention(owner.id)).filter((i) => i.href.includes(c.id)),
  ).toHaveLength(0);
  await login(page, owner.handle);
  await page.goto("/inbox");
  await page
    .getByRole("link")
    .filter({ hasText: "Retained owner-readable history" })
    .click();
  await expect(page.getByRole("log")).toContainText(
    "Retained owner-readable history",
  );
  await expect(page.getByLabel("Your message", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Report message/ }),
  ).toHaveCount(0);
  await page
    .getByLabel("Notify me about new messages as a connected owner")
    .check();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "preferences are saved" }),
  ).toBeVisible();
  await postDirectMessage(b.id, c.id, {
    body: "Owner opted in",
    clientMessageId: randomUUID(),
  });
  expect(
    (await getAttention(owner.id)).some((i) => i.preview === "Owner opted in"),
  ).toBe(true);
  await page.getByRole("button", { name: "Mark conversation read" }).click();
  expect(await db.readPosition.count({ where: { accountId: a.id } })).toBe(0);
  await expect(
    reportMessage(
      owner.id,
      `direct:${c.id}`,
      1,
      "Owner cannot submit as participant",
    ),
  ).rejects.toThrow("unavailable");
  await disconnectOwner(owner.id, a.agent!.id);
  await expect
    .poll(async () =>
      (
        await page.request.get(`/api/messages/${c.id}/messages?recent=1`)
      ).status(),
    )
    .toBe(404);
  await expect(page.getByRole("log")).toHaveCount(0, { timeout: 15000 });
  expect((await listDirectChats(owner.id)).items).toHaveLength(0);
  expect(
    (await getAttention(owner.id)).some((i) => i.href.includes(c.id)),
  ).toBe(false);
  await expect(
    setConversationPreference(owner.id, `direct:${c.id}`, true, false),
  ).rejects.toThrow("unavailable");
  await consumeClaim(nextOwner.id, (await issueClaim(a.id)).token);
  expect(
    (await listDirectChats(nextOwner.id)).items.some(
      (i) => i.preview === "Owner opted in",
    ),
  ).toBe(true);
});

test("mute, archive, block and scoped report review preserve readable history", async ({
  page,
}) => {
  const a = await seed(),
    b = await seed();
  const c = await active(a.id, b.id);
  const intro = await db.directMessage.findFirstOrThrow({
    where: { conversationId: c.id },
  });
  await login(page, a.handle);
  await page.goto(`/messages/${c.id}`);
  await page.getByRole("button", { name: "Archive chat", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "organization saved" }),
  ).toBeVisible();
  await page.goto("/inbox");
  await expect(
    page.getByRole("region", { name: "Your chats" }),
  ).not.toContainText("Private introduction");
  await page.getByRole("link", { name: "View archived chats" }).click();
  await expect(
    page.getByRole("region", { name: "Your archived chats", exact: true }),
  ).toContainText("Private introduction");
  await postDirectMessage(b.id, c.id, {
    body: "New messages bring archived chats back",
    clientMessageId: randomUUID(),
  });
  expect((await listDirectChats(a.id)).items.some((i) => i.id === c.id)).toBe(
    true,
  );
  await page.goto(`/messages/${c.id}`);
  await page.getByLabel("Mute new chat message updates").check();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "preferences are saved" }),
  ).toBeVisible();
  await postDirectMessage(b.id, c.id, {
    body: "Muted direct update",
    clientMessageId: randomUUID(),
  });
  expect((await getAttention(a.id)).some((i) => i.href.includes(c.id))).toBe(
    false,
  );
  await page
    .getByRole("button", { name: `Report message ${intro.id}`, exact: true })
    .click();
  await page
    .getByLabel("What should be reviewed?")
    .fill("Review this specific introduction.");
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Report saved" }),
  ).toBeVisible();
  const report = await db.messageReport.findFirstOrThrow({
    where: { reporterAccountId: a.id, conversationKey: `direct:${c.id}` },
  });
  const run = promisify(execFile);
  const scoped = await run(
    process.execPath,
    ["scripts/review-reports.mjs", "--show", report.id],
    { env: process.env },
  );
  expect(JSON.parse(scoped.stdout).message.body).toBe(intro.body);
  expect(scoped.stdout).not.toContain("Muted direct update");
  await page
    .getByRole("button", { name: `Block @${b.handle}`, exact: true })
    .click();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText(intro.body);
  await expect(
    postDirectMessage(b.id, c.id, {
      body: "Blocked send",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 403 });
  await page
    .getByRole("button", { name: `Unblock @${b.handle}`, exact: true })
    .click();
  await expect(page.getByLabel("Your message", { exact: true })).toBeVisible();
  await markConversationRead(a.id, `direct:${c.id}`, intro.id);
});

test("HTTP reads require current sessions and outsiders cannot hydrate direct IDs through legacy routes", async ({
  page,
  browser,
}) => {
  const a = await seed(),
    b = await seed(),
    outside = await seed();
  const c = await active(a.id, b.id);
  const signedOut = await browser.newPage();
  const api = `/api/messages/${c.id}/messages`;
  expect((await signedOut.request.get(api)).status()).toBe(401);
  await signedOut.goto(`/messages/${c.id}`);
  await expect(signedOut).toHaveURL(new RegExp(`/login\\?next=`));
  await login(page, outside.handle);
  expect((await page.request.get(api)).status()).toBe(404);
  await logout(page);
  await login(page, b.handle);
  const response = await page.request.get(api);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect((await response.json()).messages[0].body).toBe("Private introduction");
  expect((await page.request.get(`${api}?around=oops`)).status()).toBe(400);
  expect(
    (
      await page.request.post(api, {
        data: { body: "Forged sender", senderAccountId: a.id },
        headers: { Origin: "https://other.example" },
      })
    ).status(),
  ).toBe(405);
  expect(
    (await page.request.get(`/api/rooms/${c.id}/messages?after=0`)).status(),
  ).toBe(404);
  const session = await db.account.findUniqueOrThrow({ where: { id: b.id } });
  await db.account.update({
    where: { id: b.id },
    data: { sessionVersion: session.sessionVersion + 1 },
  });
  expect((await page.request.get(api)).status()).toBe(401);
  await signedOut.close();
});

test("pending decisions, stale versions, pair state and archive bounds remain explicit", async ({
  page,
}) => {
  const a = await seed(),
    b = await seed();
  const c = await pending(a.id, b.id);
  await login(page, b.handle);
  await page.goto(`/messages/${c.id}`);
  await page
    .getByRole("button", { name: "Decline chat request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chat request received" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Start a new chat request" }),
  ).toBeVisible();
  await expect(pending(a.id, b.id)).rejects.toMatchObject({ status: 409 });
  const again = await pending(b.id, a.id, "A new explicit request");
  expect(again.id).toBe(c.id);
  expect(again.requestVersion).toBe(2);
  await expect(
    respondToDirectRequest(a.id, c.id, {
      decision: "decline",
      requestVersion: 1,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(archiveDirectConversation(b.id, c.id, true)).rejects.toThrow(
    "Decide",
  );
  await setBlocked(b.id, a.id, true);
  expect(
    (await listDirectChats(a.id, "requests")).items.some((i) => i.id === c.id),
  ).toBe(true);
  expect((await getAttention(a.id)).some((i) => i.href.includes(c.id))).toBe(
    false,
  );
  await page.goto(`/messages/${c.id}`);
  await page
    .getByRole("button", { name: "Cancel chat request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chat request sent" }),
  ).toHaveCount(0);
  // Lists use bounded pages, including for previously claimed owners.
  const peerData = Array.from({ length: 32 }, (_, i) => ({
    handle: `list_${Date.now().toString(36)}_${i}`,
    type: "OWNER" as const,
    passwordHash: "fixture",
  }));
  await db.account.createMany({ data: peerData });
  const peers = await db.account.findMany({
    where: { handle: { in: peerData.map((p) => p.handle) } },
  });
  for (const p of peers) {
    const [low, high] = [a.id, p.id].sort();
    await db.directConversation.create({
      data: {
        participantLowId: low,
        participantHighId: high,
        requestedByAccountId: a.id,
        status: "ACTIVE",
      },
    });
  }
  const first = await listDirectChats(a.id);
  const second = await listDirectChats(a.id, "chats", 1);
  expect(first.items).toHaveLength(30);
  expect(first.hasNext).toBe(true);
  expect(second.items).toHaveLength(3);
  expect(second.items.some((i) => first.items.some((j) => j.id === i.id))).toBe(
    false,
  );
});

test("direct request, chat and Messages layouts fit desktop and narrow phones in both themes", async ({
  page,
}) => {
  test.setTimeout(90000);
  const a = await seed(),
    b = await seed("AGENT"),
    other = await seed();
  await db.agent.update({
    where: { id: b.agent!.id },
    data: {
      displayName: "A curious agent with a long but readable display name",
    },
  });
  const c = await active(a.id, b.id);
  await postDirectMessage(b.id, c.id, {
    body: "A long contribution: " + "continuous".repeat(80),
    clientMessageId: randomUUID(),
  });
  await login(page, a.handle);
  const routes = [
    `/messages/new/${other.handle}`,
    `/messages/${c.id}`,
    "/inbox",
  ];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      localStorage.setItem("minglo-theme", value);
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [1440, 390, 360, 320]) {
      await page.setViewportSize({ width, height: 960 });
      for (const route of routes) {
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const fits = await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        expect(fits, `${route} at ${width}px in ${theme}`).toBe(true);
        if (width <= 390) {
          const navLink = page
            .getByRole("navigation", { name: "Workspace" })
            .getByRole("link", { name: "Messages", exact: true });
          const box = await navLink.boundingBox();
          expect(
            box!.height,
            `Messages remains a usable target at ${width}px`,
          ).toBeGreaterThanOrEqual(44);
          expect(box!.width).toBeGreaterThanOrEqual(44);
        }
        await page.screenshot({
          path: test
            .info()
            .outputPath(
              `${route.includes("/new/") ? "request" : route === "/inbox" ? "inbox" : "chat"}-${width}-${theme}.png`,
            ),
          fullPage: true,
        });
      }
    }
  }
});
