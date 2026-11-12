import { test, expect } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { hash } from "argon2";
import { db } from "../../src/lib/db";
import {
  getDirectRequestContext,
  requestDirectConversation,
  respondToDirectRequest,
  postDirectMessage,
  readDirectTranscript,
  readableDirectConversations,
  markDirectConversationRead,
} from "../../src/lib/direct-messages";
import {
  issueClaim,
  consumeClaim,
  disconnectOwner,
} from "../../src/lib/claims";
import { setBlocked } from "../../src/lib/blocks";
import { setParticipationPaused } from "../../src/lib/participation";
import { createRoom } from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { getAttention, markConversationRead } from "../../src/lib/inbox";
import { allowAttempt } from "../../src/lib/rate-limit";
import { login, password } from "./helpers";

let index = 0;
async function seed(
  type: "OWNER" | "AGENT" = "OWNER",
  passwordHash = "domain-fixture",
) {
  const handle = `dm_${Date.now().toString(36)}_${index++}`;
  return db.account.create({
    data: {
      handle,
      type,
      passwordHash,
      ...(type === "AGENT"
        ? { agent: { create: { displayName: handle } } }
        : { owner: { create: { displayName: handle } } }),
    },
    include: { agent: true },
  });
}
async function request(
  a: string,
  b: string,
  body = "An introduction",
  clientMessageId: string = randomUUID(),
) {
  const context = await getDirectRequestContext(a, b);
  return requestDirectConversation(a, b, {
    body,
    clientMessageId,
    visibilityConfirmed: true,
    visibilityToken: context.visibilityToken,
  });
}
async function accept(
  recipient: string,
  actor: string,
  c: { id: string; requestVersion: number },
) {
  const context = await getDirectRequestContext(recipient, actor);
  return respondToDirectRequest(recipient, c.id, {
    decision: "accept",
    requestVersion: c.requestVersion,
    visibilityConfirmed: true,
    visibilityToken: context.visibilityToken,
  });
}
const key = (scope: string, subject: string) =>
  createHash("sha256").update(`${scope}:${subject}`).digest("hex");
test.afterAll(async () => {
  await db.$disconnect();
});

test("all person/agent pairings require recipient acceptance and preserve account authorship", async () => {
  for (const [first, second] of [
    ["OWNER", "OWNER"],
    ["OWNER", "AGENT"],
    ["AGENT", "OWNER"],
    ["AGENT", "AGENT"],
  ] as const) {
    const a = await seed(first),
      b = await seed(second),
      outside = await seed();
    const context = await getDirectRequestContext(a.id, b.id);
    expect(context.conversation).toBeNull();
    await expect(
      requestDirectConversation(a.id, b.id, {
        body: "Hello",
        clientMessageId: randomUUID(),
      }),
    ).rejects.toThrow("confirm");
    await expect(request(a.id, a.id)).rejects.toThrow("another account");
    const c = await request(a.id, b.id);
    expect(c.status).toBe("PENDING");
    expect((await readDirectTranscript(c.id, b.id))!.messages).toHaveLength(1);
    expect(await readDirectTranscript(c.id, outside.id)).toBeNull();
    await expect(
      postDirectMessage(a.id, c.id, {
        body: "Too early",
        clientMessageId: randomUUID(),
      }),
    ).rejects.toThrow("accept");
    await expect(
      respondToDirectRequest(a.id, c.id, {
        decision: "accept",
        requestVersion: 1,
      }),
    ).rejects.toThrow("recipient");
    await accept(b.id, a.id, c);
    const intro = (await readDirectTranscript(c.id, b.id))!.messages[0];
    const reply = await postDirectMessage(b.id, c.id, {
      body: `A reply @${outside.handle}`,
      replyToId: intro.id,
      clientMessageId: randomUUID(),
      senderAccountId: a.id,
    });
    expect(reply).toMatchObject({
      senderAccountId: b.id,
      accountType: second,
      replyToId: intro.id,
    });
    expect(
      await db.attentionItem.count({
        where: { recipientAccountId: outside.id, directConversationId: c.id },
      }),
    ).toBe(0);
    expect(
      await db.directMessage.count({ where: { conversationId: c.id } }),
    ).toBe(2);
    await expect(request(a.id, outside.id, "x".repeat(501))).rejects.toThrow(
      "500",
    );
    await expect(
      postDirectMessage(a.id, c.id, {
        body: "x".repeat(4001),
        clientMessageId: randomUUID(),
      }),
    ).rejects.toThrow("4,000");
  }
});

test("concurrent requests and sends reuse one pair, one introduction and one notification", async () => {
  const a = await seed(),
    b = await seed(),
    other = await seed();
  const ca = await getDirectRequestContext(a.id, b.id),
    cb = await getDirectRequestContext(b.id, a.id);
  const uuid = randomUUID();
  const args = {
    body: "Same introduction",
    clientMessageId: uuid,
    visibilityConfirmed: true,
    visibilityToken: ca.visibilityToken,
  };
  const results = await Promise.all([
    requestDirectConversation(a.id, b.id, args),
    requestDirectConversation(a.id, b.id, args),
    requestDirectConversation(b.id, a.id, {
      ...args,
      clientMessageId: randomUUID(),
      visibilityToken: cb.visibilityToken,
    }),
  ]);
  expect(new Set(results.map((c) => c.id)).size).toBe(1);
  const c = results[0];
  expect(
    await db.directMessage.count({ where: { conversationId: c.id } }),
  ).toBe(1);
  expect(
    await db.attentionItem.count({ where: { directConversationId: c.id } }),
  ).toBe(1);
  const actor = c.requestedByAccountId === a.id ? a : b,
    recipient = actor.id === a.id ? b : a;
  const intro = await db.directMessage.findFirstOrThrow({
    where: { conversationId: c.id },
  });
  await expect(
    request(
      actor.id,
      recipient.id,
      "Changed introduction",
      intro.clientMessageId,
    ),
  ).rejects.toThrow("retry key");
  const accepted = await accept(recipient.id, actor.id, c);
  expect(accepted.status).toBe("ACTIVE");
  await accept(recipient.id, actor.id, c);
  const input = { body: "One contribution", clientMessageId: randomUUID() };
  const sent = await Promise.all(
    Array.from({ length: 6 }, () => postDirectMessage(actor.id, c.id, input)),
  );
  expect(new Set(sent.map((m) => m.id)).size).toBe(1);
  expect(
    await db.attentionItem.count({
      where: { directConversationId: c.id, kind: "DIRECT_MESSAGE" },
    }),
  ).toBe(1);
  await expect(
    postDirectMessage(actor.id, c.id, { ...input, body: "Changed" }),
  ).rejects.toThrow("retry key");
  await expect(
    postDirectMessage(actor.id, c.id, {
      ...input,
      clientMessageId: intro.clientMessageId,
      body: intro.body,
    }),
  ).rejects.toThrow("retry key");
  await expect(
    db.directConversation.update({
      where: { id: c.id },
      data: { participantHighId: other.id },
    }),
  ).rejects.toThrow();
  expect(
    (await db.directConversation.findUniqueOrThrow({ where: { id: c.id } }))
      .participantHighId,
  ).toBe(ca.participants[1].id);
});

test("decline, cancellation and reversed requests are versioned and cannot reopen by sender spam", async () => {
  const a = await seed(),
    b = await seed();
  const c = await request(a.id, b.id);
  const decline = { decision: "decline", requestVersion: 1 };
  await respondToDirectRequest(b.id, c.id, decline);
  await respondToDirectRequest(b.id, c.id, decline);
  await expect(request(a.id, b.id, "Try again")).rejects.toThrow(
    "other account",
  );
  const reversed = await request(
    b.id,
    a.id,
    "The recipient chooses to reconnect",
  );
  expect(reversed).toMatchObject({
    id: c.id,
    status: "PENDING",
    requestVersion: 2,
    requestedByAccountId: b.id,
  });
  await expect(
    respondToDirectRequest(a.id, c.id, {
      decision: "accept",
      requestVersion: 1,
    }),
  ).rejects.toThrow("changed");
  await expect(
    respondToDirectRequest(a.id, c.id, {
      decision: "cancel",
      requestVersion: 2,
    }),
  ).rejects.toThrow("sender");
  await respondToDirectRequest(b.id, c.id, {
    decision: "cancel",
    requestVersion: 2,
  });
  await respondToDirectRequest(b.id, c.id, {
    decision: "cancel",
    requestVersion: 2,
  });
  await expect(request(b.id, a.id)).rejects.toThrow("other account");
  await expect(
    postDirectMessage(a.id, c.id, {
      body: "Not accepted",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toThrow("accept");
  expect(
    await db.directMessage.count({ where: { conversationId: c.id } }),
  ).toBe(2);
  const third = await request(a.id, b.id);
  await accept(b.id, a.id, third);
  expect((await readDirectTranscript(c.id, a.id))!.messages).toHaveLength(3);
});

test("current owners read retained history but cannot post or decide for an agent", async () => {
  const agent = await seed("AGENT"),
    person = await seed(),
    oldOwner = await seed(),
    newOwner = await seed();
  const c = await request(agent.id, person.id);
  await accept(person.id, agent.id, c);
  expect(await readDirectTranscript(c.id, oldOwner.id)).toBeNull();
  await consumeClaim(oldOwner.id, (await issueClaim(agent.id)).token);
  const view = (await readDirectTranscript(c.id, oldOwner.id))!;
  expect(view.conversation.isParticipant).toBe(false);
  expect(view.conversation.readers).toContainEqual(
    expect.objectContaining({ id: oldOwner.id, role: "owner" }),
  );
  await expect(
    postDirectMessage(oldOwner.id, c.id, {
      body: "As the agent",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toThrow("participating account");
  await expect(
    respondToDirectRequest(oldOwner.id, c.id, {
      decision: "decline",
      requestVersion: 1,
    }),
  ).rejects.toThrow("participating account");
  await markDirectConversationRead(oldOwner.id, c.id, view.messages[0].id);
  expect(
    await db.readPosition.findUnique({
      where: {
        accountId_conversationKey: {
          accountId: agent.id,
          conversationKey: `direct:${c.id}`,
        },
      },
    }),
  ).toBeNull();
  await Promise.all([
    disconnectOwner(oldOwner.id, agent.agent!.id),
    readDirectTranscript(c.id, oldOwner.id),
  ]);
  expect(await readDirectTranscript(c.id, oldOwner.id)).toBeNull();
  expect(
    await db.directConversation.findFirst({
      where: { id: c.id, AND: readableDirectConversations(oldOwner.id) },
    }),
  ).toBeNull();
  await expect(
    markDirectConversationRead(oldOwner.id, c.id, view.messages[0].id),
  ).rejects.toThrow("unavailable");
  await consumeClaim(newOwner.id, (await issueClaim(agent.id)).token);
  expect(
    (await readDirectTranscript(c.id, newOwner.id))!.messages[0].body,
  ).toBe("An introduction");
  const second = await seed("AGENT");
  await consumeClaim(oldOwner.id, (await issueClaim(second.id)).token);
  const pair = await request(agent.id, second.id);
  await accept(second.id, agent.id, pair);
  expect(
    (await readDirectTranscript(
      pair.id,
      oldOwner.id,
    ))!.conversation.readers.filter((r) => r.role === "owner"),
  ).toHaveLength(2);
  await disconnectOwner(newOwner.id, agent.agent!.id);
  expect(await readDirectTranscript(pair.id, newOwner.id)).toBeNull();
  expect(await readDirectTranscript(pair.id, oldOwner.id)).not.toBeNull();
});

test("changed ownership invalidates visibility confirmation at request and acceptance", async () => {
  const a = await seed("AGENT"),
    b = await seed("AGENT"),
    o1 = await seed(),
    o2 = await seed();
  const stale = await getDirectRequestContext(a.id, b.id);
  await consumeClaim(o1.id, (await issueClaim(a.id)).token);
  await expect(
    requestDirectConversation(a.id, b.id, {
      body: "Stale disclosure",
      clientMessageId: randomUUID(),
      visibilityConfirmed: true,
      visibilityToken: stale.visibilityToken,
    }),
  ).rejects.toThrow("readers changed");
  const c = await request(a.id, b.id);
  const beforeAccept = await getDirectRequestContext(b.id, a.id);
  await consumeClaim(o2.id, (await issueClaim(b.id)).token);
  await expect(
    respondToDirectRequest(b.id, c.id, {
      decision: "accept",
      requestVersion: 1,
      visibilityConfirmed: true,
      visibilityToken: beforeAccept.visibilityToken,
    }),
  ).rejects.toThrow("readers changed");
  await accept(b.id, a.id, c);
  expect(
    (await readDirectTranscript(c.id, o2.id))!.conversation.isParticipant,
  ).toBe(false);
});

test("blocks and owner pause serialize with sends; owner participants still speak as themselves", async () => {
  const a = await seed("AGENT"),
    b = await seed(),
    other = await seed();
  await consumeClaim(b.id, (await issueClaim(a.id)).token);
  await setBlocked(b.id, a.id, true);
  await expect(request(a.id, b.id)).rejects.toThrow("preferences");
  await setBlocked(b.id, a.id, false);
  const c = await request(a.id, b.id);
  await setBlocked(a.id, b.id, true);
  await expect(accept(b.id, a.id, c)).rejects.toThrow("preferences");
  await setBlocked(a.id, b.id, false);
  await accept(b.id, a.id, c);
  await Promise.allSettled([
    setParticipationPaused(b.id, a.agent!.id, true),
    postDirectMessage(a.id, c.id, {
      body: "Racing the pause",
      clientMessageId: randomUUID(),
    }),
  ]);
  await expect(
    postDirectMessage(a.id, c.id, {
      body: "Paused",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toThrow("paused");
  await expect(request(a.id, other.id)).rejects.toThrow("paused");
  const own = await postDirectMessage(b.id, c.id, {
    body: "Speaking as a person",
    clientMessageId: randomUUID(),
    senderAccountId: a.id,
  });
  expect(own.senderAccountId).toBe(b.id);
  await setParticipationPaused(b.id, a.agent!.id, false);
  await Promise.allSettled([
    setBlocked(b.id, a.id, true),
    postDirectMessage(a.id, c.id, {
      body: "Racing the block",
      clientMessageId: randomUUID(),
    }),
  ]);
  await expect(
    postDirectMessage(a.id, c.id, {
      body: "Blocked",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toThrow("preferences");
  expect(await readDirectTranscript(c.id, b.id)).not.toBeNull();
});

test("daily requests and the shared private-post budget charge once and preserve legacy windows", async () => {
  const a = await seed();
  const contacts = await Promise.all(Array.from({ length: 6 }, () => seed()));
  const created = [];
  for (const b of contacts.slice(0, 5)) created.push(await request(a.id, b.id));
  await expect(request(a.id, contacts[5].id)).rejects.toThrow("tomorrow");
  expect(
    await db.directConversation.count({
      where: { OR: [{ participantLowId: a.id }, { participantHighId: a.id }] },
    }),
  ).toBe(5);
  const limit = await db.rateLimit.findUniqueOrThrow({
    where: { key: key("direct-request", a.id) },
  });
  expect(limit.count).toBe(5);
  // RateLimit is a timestamp without timezone; compare using the database clock.
  const remaining = async (rateKey: string) =>
    (
      await db.$queryRaw<
        { seconds: number }[]
      >`SELECT EXTRACT(EPOCH FROM ("resetAt" - NOW()))::float8 AS seconds FROM "RateLimit" WHERE "key" = ${rateKey}`
    )[0].seconds;
  expect(await remaining(limit.key)).toBeGreaterThan(23 * 3600);
  expect(await remaining(limit.key)).toBeLessThanOrEqual(24 * 3600 + 1);
  const intro = await db.directMessage.findFirstOrThrow({
    where: { conversationId: created[0].id },
  });
  await request(a.id, contacts[0].id, intro.body, intro.clientMessageId);
  expect(
    (await db.rateLimit.findUniqueOrThrow({ where: { key: limit.key } })).count,
  ).toBe(5);
  const actor = await seed("AGENT"),
    recipient = await seed();
  const c = await request(actor.id, recipient.id);
  await accept(recipient.id, actor.id, c);
  await db.rateLimit.update({
    where: { key: key("private-post", actor.id) },
    data: { count: 59 },
  });
  const input = { body: "The last slot", clientMessageId: randomUUID() };
  await postDirectMessage(actor.id, c.id, input);
  await postDirectMessage(actor.id, c.id, input);
  const room = await createRoom(actor.id, "Shared private budget");
  await expect(
    postMessage(room.id, actor.id, {
      body: "Over budget",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toThrow("Too many private");
  expect(
    (
      await db.rateLimit.findUniqueOrThrow({
        where: { key: key("private-post", actor.id) },
      })
    ).count,
  ).toBe(60);
  await allowAttempt("legacy-window", a.id);
  const legacy = await db.rateLimit.findUniqueOrThrow({
    where: { key: key("legacy-window", a.id) },
  });
  expect(await remaining(legacy.key)).toBeLessThanOrEqual(15 * 60 + 1);
  expect(await remaining(legacy.key)).toBeGreaterThan(14 * 60);
});

test("direct paging, reply boundaries, mute and reading positions stay scoped and bounded", async () => {
  const a = await seed(),
    b = await seed(),
    other = await seed();
  const c = await request(a.id, b.id);
  await accept(b.id, a.id, c);
  const foreign = await request(a.id, other.id);
  const foreignMessage = await db.directMessage.findFirstOrThrow({
    where: { conversationId: foreign.id },
  });
  await expect(
    postDirectMessage(a.id, c.id, {
      body: "Wrong parent",
      clientMessageId: randomUUID(),
      replyToId: foreignMessage.id,
    }),
  ).rejects.toThrow("in this chat");
  await db.directMessage.createMany({
    data: Array.from({ length: 70 }, (_, i) => ({
      conversationId: c.id,
      senderAccountId: a.id,
      body: `Retained ${i}`,
      clientMessageId: randomUUID(),
    })),
  });
  const recent = (await readDirectTranscript(c.id, b.id))!;
  expect(recent.messages).toHaveLength(50);
  expect(recent.hasOlder).toBe(true);
  const older = (await readDirectTranscript(
    c.id,
    b.id,
    new URLSearchParams(`before=${recent.messages[0].id}`),
  ))!;
  expect(older.messages).toHaveLength(21);
  expect(
    await readDirectTranscript(
      c.id,
      b.id,
      new URLSearchParams(`around=${foreignMessage.id}`),
    ),
  ).toBeNull();
  await expect(
    readDirectTranscript(c.id, b.id, new URLSearchParams("before=0")),
  ).rejects.toThrow("cursor");
  await markDirectConversationRead(b.id, c.id, recent.messages.at(-1)!.id);
  await markDirectConversationRead(b.id, c.id, recent.messages[0].id);
  expect(
    (
      await db.readPosition.findUniqueOrThrow({
        where: {
          accountId_conversationKey: {
            accountId: b.id,
            conversationKey: `direct:${c.id}`,
          },
        },
      })
    ).lastMessageId,
  ).toBe(recent.messages.at(-1)!.id);
  await expect(
    markDirectConversationRead(other.id, c.id, recent.messages[0].id),
  ).rejects.toThrow("unavailable");
  await expect(
    markDirectConversationRead(b.id, c.id, foreignMessage.id),
  ).rejects.toThrow("unavailable");
  await markConversationRead(b.id, `direct:${c.id}`, recent.messages[0].id);
  await db.conversationPreference.create({
    data: { accountId: b.id, conversationKey: `direct:${c.id}`, muted: true },
  });
  const before = await db.attentionItem.count({
    where: { directConversationId: c.id },
  });
  await postDirectMessage(a.id, c.id, {
    body: "Muted update",
    clientMessageId: randomUUID(),
  });
  expect(
    await db.attentionItem.count({ where: { directConversationId: c.id } }),
  ).toBe(before);
  expect((await getAttention(b.id)).some((x) => x.href.includes(c.id))).toBe(
    false,
  );
});

test("claim review discloses retained direct history without exposing its messages before claiming", async ({
  page,
}) => {
  const a = await seed("AGENT"),
    person = await seed(),
    owner = await seed("OWNER", await hash(password));
  const c = await request(
    a.id,
    person.id,
    "Private introduction stays private",
  );
  const claim = await issueClaim(a.id);
  await login(page, owner.handle);
  await page.goto(`/claim/${claim.token}`);
  await expect(
    page.getByRole("heading", {
      name: "Direct chat history you’ll gain access to",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("1 direct chat, including retained introductions.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "Private introduction stays private",
  );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm and claim agent", exact: true })
    .click();
  await expect(page).toHaveURL(/claimed=1/);
  expect((await readDirectTranscript(c.id, owner.id))!.messages[0].body).toBe(
    "Private introduction stays private",
  );
});
