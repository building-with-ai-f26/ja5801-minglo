import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import { readFileSync } from "node:fs";
import { db } from "../../src/lib/db";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
  readTranscript,
} from "../../src/lib/rooms";
import {
  leaveRoom,
  removeParticipant,
  closeRoom,
} from "../../src/lib/room-controls";
import { postMessage } from "../../src/lib/messages";
import { issueClaim, consumeClaim } from "../../src/lib/claims";
import { login, password } from "./helpers";

async function seed(label: string, type: "AGENT" | "OWNER" = "AGENT") {
  return db.account.create({
    data: {
      handle: `${label}_${Date.now().toString(36)}`,
      type,
      passwordHash: await hash(password),
      ...(type === "AGENT"
        ? { agent: { create: { displayName: label } } }
        : { owner: { create: { displayName: label } } }),
    },
    include: { agent: true },
  });
}
async function invite(
  creator: string,
  roomId: string,
  account: { id: string; handle: string },
) {
  await inviteAgent(creator, roomId, account.handle);
  return db.membership.findFirstOrThrow({
    where: { roomId, agent: { accountId: account.id } },
  });
}
test.afterAll(async () => {
  await db.$disconnect();
});

test("the room-control migration preserves pre-existing membership and history", async () => {
  const migration = readFileSync(
    "prisma/migrations/202611110001_room_controls/migration.sql",
    "utf8",
  );
  const schema = `room_migration_${randomUUID().replaceAll("-", "")}`;
  const rollback = new Error("rollback migration fixture");
  await expect(
    db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(
        `CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED')`,
      );
      await tx.$executeRawUnsafe(
        `CREATE TABLE "Room" (id TEXT PRIMARY KEY, title TEXT)`,
      );
      await tx.$executeRawUnsafe(
        `CREATE TABLE "Membership" (status "MembershipStatus")`,
      );
      await tx.$executeRawUnsafe(`CREATE TABLE "Message" (body TEXT)`);
      await tx.$executeRawUnsafe(
        `INSERT INTO "Room" VALUES ('existing', 'Retained room')`,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "Membership" VALUES ('ACCEPTED')`,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "Message" VALUES ('Retained message')`,
      );
      for (const statement of migration
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.$executeRawUnsafe(statement);
      expect(
        await tx.$queryRawUnsafe(`SELECT title, "closedAt" FROM "Room"`),
      ).toEqual([{ title: "Retained room", closedAt: null }]);
      expect(
        await tx.$queryRawUnsafe(`SELECT status::text FROM "Membership"`),
      ).toEqual([{ status: "ACCEPTED" }]);
      expect(await tx.$queryRawUnsafe(`SELECT body FROM "Message"`)).toEqual([
        { body: "Retained message" },
      ]);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
});

test("removal and leaving revoke private history for agents and claimed owners", async ({
  browser,
}) => {
  const creator = await seed("controls_creator");
  const agent = await seed("controls_agent");
  const owner = await seed("controls_owner", "OWNER");
  const outsider = await seed("controls_other");
  const room = await createRoom(creator.id, "Room control history");
  const membership = await invite(creator.id, room.id, agent);
  await respondToInvitation(agent.id, membership.id, true);
  await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
  await postMessage(room.id, agent.id, {
    body: "Retained history",
    clientMessageId: randomUUID(),
  });
  await expect(
    removeParticipant(outsider.id, room.id, agent.agent!.id),
  ).rejects.toThrow("creator");
  await expect(
    removeParticipant(owner.id, room.id, agent.agent!.id),
  ).rejects.toThrow("creator");
  await expect(
    removeParticipant(creator.id, room.id, creator.agent!.id),
  ).rejects.toThrow("close");
  await expect(leaveRoom(creator.id, room.id)).rejects.toThrow("close");
  const page = await browser.newPage();
  const watch = await browser.newPage();
  await login(page, agent.handle);
  await login(watch, owner.handle);
  await page.goto(`/rooms/${room.id}`);
  await expect(page.getByRole("log")).toContainText("Retained history");
  await removeParticipant(creator.id, room.id, agent.agent!.id);
  expect(
    (
      await page.request.get(`/api/rooms/${room.id}/messages?before=999999`)
    ).status(),
  ).toBe(404);
  expect(
    (await watch.request.get(`/api/rooms/${room.id}/messages`)).status(),
  ).toBe(404);
  await expect(page.getByRole("log")).not.toContainText("Retained history");
  await expect(
    postMessage(room.id, agent.id, {
      body: "Denied",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 403 });
  await invite(creator.id, room.id, agent);
  expect(await readTranscript(room.id, agent.id)).toBeNull();
  await respondToInvitation(agent.id, membership.id, true);
  expect((await readTranscript(room.id, owner.id))!.messages).toHaveLength(1);
  await page.goto(`/rooms/${room.id}`);
  await page
    .locator("summary")
    .filter({ hasText: "Leave conversation" })
    .click();
  await page
    .getByLabel("I understand I will lose access to this conversation.")
    .check();
  await page
    .getByRole("button", { name: "Leave conversation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard/);
  expect(await readTranscript(room.id, agent.id)).toBeNull();
  expect(await readTranscript(room.id, owner.id)).toBeNull();
  expect(await db.message.count({ where: { roomId: room.id } })).toBe(1);
  await page.close();
  await watch.close();
});

test("closing retains authorized history, cancels pending invites and prevents writes", async () => {
  const creator = await seed("close_creator");
  const agent = await seed("close_agent");
  const pending = await seed("close_pending");
  const room = await createRoom(creator.id, "Closing safely");
  const membership = await invite(creator.id, room.id, agent);
  await respondToInvitation(agent.id, membership.id, true);
  const invitation = await invite(creator.id, room.id, pending);
  await postMessage(room.id, creator.id, {
    body: "Keep this",
    clientMessageId: randomUUID(),
  });
  await expect(closeRoom(agent.id, room.id)).rejects.toThrow("creator");
  await closeRoom(creator.id, room.id);
  expect((await readTranscript(room.id, agent.id))!.messages).toHaveLength(1);
  for (const account of [creator, agent])
    await expect(
      postMessage(room.id, account.id, {
        body: "Denied",
        clientMessageId: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 403 });
  await expect(
    inviteAgent(creator.id, room.id, pending.handle),
  ).rejects.toThrow("closed");
  await expect(
    respondToInvitation(pending.id, invitation.id, true),
  ).rejects.toThrow();
  await leaveRoom(agent.id, room.id);
  expect(await readTranscript(room.id, agent.id)).toBeNull();
});

test("a concurrent removal cannot be undone by accepting the pending invitation", async () => {
  const creator = await seed("race_creator");
  const agent = await seed("race_agent");
  const room = await createRoom(creator.id, "Concurrent access changes");
  const membership = await invite(creator.id, room.id, agent);
  await Promise.allSettled([
    respondToInvitation(agent.id, membership.id, true),
    removeParticipant(creator.id, room.id, agent.agent!.id),
  ]);
  expect(
    (await db.membership.findUniqueOrThrow({ where: { id: membership.id } }))
      .status,
  ).toBe("REMOVED");
  expect(await readTranscript(room.id, agent.id)).toBeNull();
});
