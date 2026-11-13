import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import {
  consumeClaim,
  issueClaim,
  disconnectOwner,
} from "../../src/lib/claims";
import {
  listDirectChats,
  InvalidDirectAgentFilterError,
} from "../../src/lib/direct-views";
import { getDirectReturns } from "../../src/lib/return-activity";
import { login } from "./helpers";
import {
  structureAccount as account,
  structureChat as chat,
} from "./app-structure-fixtures";

test.afterAll(() => db.$disconnect());

async function connect(owner: string, agent: string) {
  await consumeClaim(owner, (await issueClaim(agent)).token);
}

test("Home selects disjoint personal and observed priorities before limits and never acknowledges reads", async ({
  page,
}) => {
  const viewer = await account(),
    agent = await account("AGENT"),
    peer = await account();
  await connect(viewer.id, agent.id);
  const same = new Date("2026-10-02T12:00:00Z");
  const incoming = [];
  const personal = [];
  for (let i = 0; i < 5; i++) {
    incoming.push(
      await chat(
        (await account()).id,
        viewer.id,
        `Older incoming ${i}`,
        "PENDING",
        same,
      ),
    );
    personal.push(
      await chat(
        viewer.id,
        (await account()).id,
        `Outgoing ${i}`,
        "PENDING",
        same,
      ),
    );
  }
  // More than a full Messages page of recent observed activity.
  for (let i = 0; i < 34; i++)
    await chat(
      agent.id,
      (await account()).id,
      `Recent observed ${i}`,
      i % 2 ? "ACTIVE" : "PENDING",
    );
  const active = await chat(
    peer.id,
    viewer.id,
    "Unread personal active",
    "ACTIVE",
  );
  const muted = await chat(
    (await account()).id,
    viewer.id,
    "Muted return omitted",
    "ACTIVE",
  );
  const archived = await chat(
    (await account()).id,
    viewer.id,
    "Archived return omitted",
    "ACTIVE",
  );
  const read = await chat(
    (await account()).id,
    viewer.id,
    "Already read omitted",
    "ACTIVE",
  );
  await db.conversationPreference.createMany({
    data: [
      {
        accountId: viewer.id,
        conversationKey: `direct:${muted.id}`,
        muted: true,
      },
      {
        accountId: viewer.id,
        conversationKey: `direct:${archived.id}`,
        archivedAt: new Date(Date.now() + 1000),
      },
    ],
  });
  await db.readPosition.create({
    data: {
      accountId: viewer.id,
      conversationKey: `direct:${read.id}`,
      lastMessageId: read.messages[0].id,
    },
  });
  const positions = await db.readPosition.findMany({
    orderBy: [{ accountId: "asc" }, { conversationKey: "asc" }],
  });
  const preferences = await db.conversationPreference.findMany({
    where: { accountId: viewer.id },
    orderBy: { conversationKey: "asc" },
  });
  const groups = await getDirectReturns(viewer.id);
  expect(groups.incoming.map((c) => c.id)).toEqual(
    incoming
      .map((c) => c.id)
      .sort()
      .reverse()
      .slice(0, 3),
  );
  expect(groups.personal.map((c) => c.id)).toEqual([
    active.id,
    ...personal
      .map((c) => c.id)
      .sort()
      .reverse()
      .slice(0, 2),
  ]);
  expect(groups.observing).toHaveLength(3);
  expect(
    groups.incoming.every(
      (c) => c.requestDirection === "incoming" && c.access === "participant",
    ),
  ).toBe(true);
  expect(
    groups.observing.every(
      (c) => !c.isParticipant && c.access === "owner-read-only",
    ),
  ).toBe(true);
  const ids = Object.values(groups)
    .flat()
    .map((c) => c.id);
  expect(new Set(ids).size).toBe(9);
  expect(ids).not.toContain(muted.id);
  expect(ids).not.toContain(archived.id);
  expect(ids).not.toContain(read.id);
  expect(await getDirectReturns(viewer.id)).toEqual(groups);
  await login(page, viewer.handle);
  const personalRequests = page.getByRole("region", {
    name: "Chat requests for you",
    exact: true,
  });
  for (const item of groups.incoming)
    await expect(
      personalRequests.locator(`a[href="/messages/${item.id}"]`),
    ).toBeVisible();
  await expect(personalRequests.locator(".room-card")).toHaveCount(3);
  await expect(
    page
      .getByRole("region", { name: "Your agents’ direct chats", exact: true })
      .locator(".room-card"),
  ).toHaveCount(3);

  expect(
    await db.readPosition.findMany({
      orderBy: [{ accountId: "asc" }, { conversationKey: "asc" }],
    }),
  ).toEqual(positions);
  expect(
    await db.conversationPreference.findMany({
      where: { accountId: viewer.id },
      orderBy: { conversationKey: "asc" },
    }),
  ).toEqual(preferences);
});

test("zero-agent people get personal returns and participant rights override owner observation", async () => {
  const viewer = await account(),
    agent = await account("AGENT"),
    peer = await account();
  const incoming = await chat(peer.id, viewer.id, "Person receives a request");
  expect((await getDirectReturns(viewer.id)).incoming.map((c) => c.id)).toEqual(
    [incoming.id],
  );
  await connect(viewer.id, agent.id);
  const outgoing = await chat(viewer.id, agent.id, "Person messages own agent");
  const list = await listDirectChats(
    viewer.id,
    "chats",
    0,
    false,
    agent.agent!.id,
  );
  expect(list.items).toEqual([
    expect.objectContaining({
      id: outgoing.id,
      access: "participant",
      isParticipant: true,
      requestDirection: "outgoing",
    }),
  ]);
  expect(list.counts).toEqual({ incoming: 0, observedRequests: 0 });
  const groups = await getDirectReturns(viewer.id);
  expect(groups.personal.map((c) => c.id)).toContain(outgoing.id);
  expect(groups.observing).toEqual([]);
});

test("filtered requests and counts share authorization while observed outgoing requests stay read only", async () => {
  const viewer = await account(),
    a = await account("AGENT"),
    b = await account("AGENT"),
    empty = await account("AGENT");
  for (const agent of [a, b, empty]) await connect(viewer.id, agent.id);
  const personal = await chat(a.id, viewer.id, "Incoming from own agent");
  const observedOutgoing = await chat(
    a.id,
    (await account()).id,
    "Agent sends a request",
  );
  const observedIncoming = await chat(
    (await account()).id,
    b.id,
    "Agent receives a request",
  );
  const outgoing = await chat(viewer.id, b.id, "Owner sends a request");
  const all = await listDirectChats(viewer.id, "requests");
  expect(all.counts).toEqual({ incoming: 1, observedRequests: 2 });
  expect(new Set(all.items.map((c) => c.id))).toEqual(
    new Set([personal.id, observedOutgoing.id, observedIncoming.id]),
  );
  const filtered = await listDirectChats(
    viewer.id,
    "requests",
    0,
    false,
    a.agent!.id,
  );
  expect(filtered.selectedAgent).toMatchObject({
    id: a.agent!.id,
    accountId: a.id,
    handle: a.handle,
  });
  expect(filtered.counts).toEqual({ incoming: 1, observedRequests: 1 });
  expect(new Set(filtered.items.map((c) => c.id))).toEqual(
    new Set([personal.id, observedOutgoing.id]),
  );
  expect(
    filtered.items.find((c) => c.id === personal.id)?.requestDirection,
  ).toBe("incoming");
  expect(
    filtered.items.find((c) => c.id === observedOutgoing.id)?.requestDirection,
  ).toBe("observed");
  expect((await listDirectChats(viewer.id)).items.map((c) => c.id)).toEqual([
    outgoing.id,
  ]);
  expect((await listDirectChats(viewer.id, "requests", 50)).counts).toEqual(
    all.counts,
  );
  expect(
    (await listDirectChats(viewer.id, "requests", 0, false, empty.agent!.id))
      .items,
  ).toEqual([]);
  for (const invalid of [
    "",
    "bad-id",
    a.id,
    (await account("AGENT")).agent!.id,
  ])
    await expect(
      listDirectChats(viewer.id, "chats", 0, false, invalid),
    ).rejects.toBeInstanceOf(InvalidDirectAgentFilterError);
  await expect(
    listDirectChats(a.id, "chats", 0, false, a.agent!.id),
  ).rejects.toBeInstanceOf(InvalidDirectAgentFilterError);
  await disconnectOwner(viewer.id, a.agent!.id);
  await expect(
    listDirectChats(viewer.id, "requests", 0, false, a.agent!.id),
  ).rejects.toBeInstanceOf(InvalidDirectAgentFilterError);
  const after = await listDirectChats(viewer.id, "requests");
  expect(after.items.map((c) => c.id)).not.toContain(observedOutgoing.id);
  expect(after.items.map((c) => c.id)).toContain(personal.id); // immutable participant
  expect(after.counts).toEqual({ incoming: 1, observedRequests: 1 });
});

test("filtered archive and stable pagination operate before limits and new activity resurfaces", async () => {
  const viewer = await account(),
    a = await account("AGENT"),
    b = await account("AGENT");
  await connect(viewer.id, a.id);
  await connect(viewer.id, b.id);
  const tied = new Date("2026-10-05T12:00:00Z");
  const selected = [];
  for (let i = 0; i < 32; i++)
    selected.push(
      await chat(a.id, (await account()).id, `Selected ${i}`, "ACTIVE", tied),
    );
  for (let i = 0; i < 31; i++)
    await chat(b.id, (await account()).id, `Other agent ${i}`, "ACTIVE");
  const archived = selected.pop()!;
  const archivedAt = new Date("2026-10-06T12:00:00Z");
  await db.conversationPreference.create({
    data: {
      accountId: viewer.id,
      conversationKey: `direct:${archived.id}`,
      archivedAt,
    },
  });
  const first = await listDirectChats(
    viewer.id,
    "chats",
    0,
    false,
    a.agent!.id,
  );
  const second = await listDirectChats(
    viewer.id,
    "chats",
    1,
    false,
    a.agent!.id,
  );
  expect(first.items).toHaveLength(30);
  expect(first.hasNext).toBe(true);
  expect(second.items).toHaveLength(1);
  expect(second.hasNext).toBe(false);
  expect([...first.items, ...second.items].map((c) => c.id)).toEqual(
    selected
      .map((c) => c.id)
      .sort()
      .reverse(),
  );
  expect(
    (await listDirectChats(viewer.id, "chats", 0, true, a.agent!.id)).items.map(
      (c) => c.id,
    ),
  ).toEqual([archived.id]);
  await db.directConversation.update({
    where: { id: archived.id },
    data: { updatedAt: new Date(archivedAt.getTime() + 1) },
  });
  expect(
    (await listDirectChats(viewer.id, "chats", 0, true, a.agent!.id)).items,
  ).toEqual([]);
  expect(
    (await listDirectChats(viewer.id, "chats", 0, false, a.agent!.id)).items[0]
      .id,
  ).toBe(archived.id);
});

test("a concurrent disconnect never leaks observed bodies and keeps independent participant access", async () => {
  const viewer = await account(),
    a = await account("AGENT"),
    peer = await account();
  await connect(viewer.id, a.id);
  const observed = await chat(
    a.id,
    peer.id,
    "Revoked owner private preview",
    "ACTIVE",
  );
  const personal = await chat(
    viewer.id,
    a.id,
    "Independent personal preview",
    "ACTIVE",
  );
  // Readers and disconnect use the same Agent lock; either legal serialization
  // can win. After disconnect commits, no read may use the revoked connection.
  const race = await Promise.allSettled([
    listDirectChats(viewer.id, "chats", 0, false, a.agent!.id),
    getDirectReturns(viewer.id),
    disconnectOwner(viewer.id, a.agent!.id),
  ]);
  expect(race[2].status).toBe("fulfilled");
  if (race[0].status === "rejected")
    expect(race[0].reason).toBeInstanceOf(InvalidDirectAgentFilterError);
  expect(race[1].status).toBe("fulfilled");
  await expect(
    listDirectChats(viewer.id, "chats", 0, false, a.agent!.id),
  ).rejects.toBeInstanceOf(InvalidDirectAgentFilterError);
  const rows = await listDirectChats(viewer.id);
  expect(rows.items.map((c) => c.id)).toEqual([personal.id]);
  expect(JSON.stringify(await getDirectReturns(viewer.id))).not.toContain(
    observed.messages[0].body,
  );
});

test("declined and cancelled history stays in Chats with no pending request classification", async () => {
  const viewer = await account(),
    a = await account("AGENT");
  const declined = await chat(
    viewer.id,
    (await account()).id,
    "Declined personal history",
    "DECLINED",
  );
  const cancelled = await chat(
    (await account()).id,
    viewer.id,
    "Cancelled personal history",
    "CANCELLED",
  );
  await connect(viewer.id, a.id);
  const observed = await chat(
    a.id,
    (await account()).id,
    "Cancelled observed history",
    "CANCELLED",
  );
  const current = await listDirectChats(viewer.id);
  expect(new Set(current.items.map((c) => c.id))).toEqual(
    new Set([declined.id, cancelled.id, observed.id]),
  );
  expect(current.items.every((c) => c.requestDirection === null)).toBe(true);
  expect(current.counts).toEqual({ incoming: 0, observedRequests: 0 });
  expect((await listDirectChats(viewer.id, "requests")).items).toEqual([]);
  expect(await getDirectReturns(viewer.id)).toEqual({
    incoming: [],
    personal: [],
    observing: [],
  });
});
