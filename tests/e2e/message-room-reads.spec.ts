import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import {
  listMessageChats,
  InvalidDirectAgentFilterError,
} from "../../src/lib/direct-views";
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
import { closeRoom, removeParticipant } from "../../src/lib/room-controls";
import { postMessage } from "../../src/lib/messages";
import {
  structureAccount as account,
  structureChat as chat,
} from "./app-structure-fixtures";

test.afterAll(() => db.$disconnect());
const connect = async (owner: string, agent: string) =>
  consumeClaim(owner, (await issueClaim(agent)).token);
async function admit(
  creator: string,
  room: string,
  handle: string,
  agentId: string,
) {
  await inviteAgent(creator, room, handle);
  const member = await db.membership.findUniqueOrThrow({
    where: { roomId_agentId: { roomId: room, agentId } },
  });
  await respondToInvitation(
    (await db.agent.findUniqueOrThrow({ where: { id: agentId } })).accountId,
    member.id,
    true,
  );
}

test("room previews require current accepted access, survive reads/mute and never grant an owner posting rights", async () => {
  const owner = await account(),
    a = await account("AGENT"),
    invited = await account("AGENT"),
    creator = await account("AGENT");
  const room = await createRoom(
    creator.id,
    "Existing history before owner connection",
  );
  await admit(creator.id, room.id, a.handle, a.agent!.id);
  await inviteAgent(creator.id, room.id, invited.handle);
  const message = await postMessage(room.id, creator.id, {
    body: "Retained agent-room history",
    clientMessageId: randomUUID(),
  });
  expect((await listMessageChats(owner.id)).items).toEqual([]);
  await connect(owner.id, a.id);
  await connect(owner.id, invited.id);
  let rows = await listMessageChats(owner.id);
  expect(rows.items).toMatchObject([
    {
      kind: "room",
      id: room.id,
      preview: message.body,
      access: "owner-read-only",
    },
  ]);
  expect(
    (await listMessageChats(owner.id, "chats", 0, false, invited.agent!.id))
      .items,
  ).toEqual([]);
  expect((await listMessageChats(a.id)).items).toMatchObject([
    { id: room.id, access: "participant" },
  ]);
  await expect(
    postMessage(room.id, owner.id, {
      body: "An owner must not post as its agent",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toThrow("Only admitted agents");
  await db.readPosition.create({
    data: {
      accountId: owner.id,
      conversationKey: `private:${room.id}`,
      lastMessageId: message.id,
    },
  });
  await db.conversationPreference.create({
    data: {
      accountId: owner.id,
      conversationKey: `private:${room.id}`,
      muted: true,
    },
  });
  const before = await db.readPosition.findMany({
    where: { accountId: { in: [owner.id, a.id] } },
  });
  rows = await listMessageChats(owner.id, "chats", 0, false, a.agent!.id);
  expect(rows.items).toMatchObject([{ id: room.id, unread: 0, muted: true }]);
  expect(
    await db.readPosition.findMany({
      where: { accountId: { in: [owner.id, a.id] } },
    }),
  ).toEqual(before);
  await removeParticipant(creator.id, room.id, a.agent!.id);
  expect((await listMessageChats(owner.id)).items).toEqual([]);
  expect((await listMessageChats(a.id)).items).toEqual([]);
});

test("one stable Messages page combines room and direct IDs without hiding requests or changing direct archives", async () => {
  const owner = await account(),
    a = await account("AGENT");
  await connect(owner.id, a.id);
  const same = new Date("2026-10-01T12:00:00Z");
  const all: string[] = [],
    directs: string[] = [],
    rooms: string[] = [];
  for (let i = 0; i < 18; i++) {
    const r = await db.room.create({
      data: {
        title: `Paged room ${i}`,
        creatorAccountId: a.id,
        createdAt: same,
        memberships: { create: { agentId: a.agent!.id, status: "ACCEPTED" } },
        messages: {
          create: {
            senderAgentId: a.agent!.id,
            body: `Room preview ${i}`,
            clientMessageId: randomUUID(),
            createdAt: same,
          },
        },
      },
    });
    const d = await chat(
      a.id,
      (await account()).id,
      `Direct preview ${i}`,
      "ACTIVE",
      same,
    );
    rooms.push(r.id);
    directs.push(d.id);
    all.push(`room:${r.id}`, `direct:${d.id}`);
  }
  const first = await listMessageChats(owner.id),
    second = await listMessageChats(owner.id, "chats", 1);
  const keys = (items: typeof first.items) =>
    items.map((c) => `${c.kind}:${c.id}`);
  expect(first.items).toHaveLength(30);
  expect(first.hasNext).toBe(true);
  expect(second.items).toHaveLength(6);
  expect(second.hasNext).toBe(false);
  expect(new Set([...keys(first.items), ...keys(second.items)])).toEqual(
    new Set(all),
  );
  expect(keys((await listMessageChats(owner.id)).items)).toEqual(
    keys(first.items),
  );
  expect(new Set(first.items.map((c) => c.kind))).toEqual(
    new Set(["direct", "room"]),
  );
  await db.conversationPreference.create({
    data: {
      accountId: owner.id,
      conversationKey: `direct:${directs[0]}`,
      archivedAt: new Date(),
    },
  });
  const archived = await listMessageChats(owner.id, "chats", 0, true);
  expect(archived.items).toMatchObject([{ kind: "direct", id: directs[0] }]);
  await closeRoom(a.id, rooms[0]);
  const incoming = await chat(
    (await account()).id,
    owner.id,
    "Incoming personal request",
  );
  const observed = await chat(
    a.id,
    (await account()).id,
    "Observed pending request",
  );
  const requests = await listMessageChats(owner.id, "requests");
  expect(new Set(requests.items.map((c) => c.id))).toEqual(
    new Set([incoming.id, observed.id]),
  );
  expect(requests.items.every((c) => c.kind === "direct")).toBe(true);
  expect(requests.counts).toEqual({ incoming: 1, observedRequests: 1 });
  const current = [
    ...(await listMessageChats(owner.id)).items,
    ...(await listMessageChats(owner.id, "chats", 1)).items,
  ];
  expect(
    current.some(
      (c) =>
        c.id === directs[0] || c.id === observed.id || c.id === incoming.id,
    ),
  ).toBe(false);
  expect(current.find((c) => c.id === rooms[0])).toMatchObject({
    kind: "room",
    closed: true,
  });
  await expect(
    listMessageChats(owner.id, "chats", 0, false, owner.id),
  ).rejects.toBeInstanceOf(InvalidDirectAgentFilterError);
});

test("concurrent room removal and owner disconnection revoke previews while creator access survives", async () => {
  const owner = await account(),
    a = await account("AGENT"),
    creator = await account("AGENT");
  await connect(owner.id, a.id);
  const observed = await createRoom(creator.id, "Revoked room preview");
  await admit(creator.id, observed.id, a.handle, a.agent!.id);
  await postMessage(observed.id, creator.id, {
    body: "Revoked private room body",
    clientMessageId: randomUUID(),
  });
  const independent = await createRoom(owner.id, "Independent creator room");
  await admit(owner.id, independent.id, a.handle, a.agent!.id);
  const race = await Promise.allSettled([
    listMessageChats(owner.id, "chats", 0, false, a.agent!.id),
    removeParticipant(creator.id, observed.id, a.agent!.id),
    disconnectOwner(owner.id, a.agent!.id),
  ]);
  expect(race[1].status).toBe("fulfilled");
  expect(race[2].status).toBe("fulfilled");
  if (race[0].status === "rejected")
    expect(race[0].reason).toBeInstanceOf(InvalidDirectAgentFilterError);
  const after = await listMessageChats(owner.id);
  expect(after.items).toMatchObject([
    { id: independent.id, kind: "room", access: "creator-read-only" },
  ]);
  expect(JSON.stringify(after)).not.toContain("Revoked private room body");
  await expect(
    listMessageChats(owner.id, "chats", 0, false, a.agent!.id),
  ).rejects.toBeInstanceOf(InvalidDirectAgentFilterError);
});
