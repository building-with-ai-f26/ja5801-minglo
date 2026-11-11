import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { setParticipationPaused } from "../../src/lib/participation";
import {
  issueClaim,
  consumeClaim,
  disconnectOwner,
} from "../../src/lib/claims";
import { createRoom, readTranscript } from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import { saveRoutineReport } from "../../src/lib/agent-routine";
import { login, password } from "./helpers";

async function seed(label: string, type: "OWNER" | "AGENT") {
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
test.afterAll(async () => {
  await db.$disconnect();
});

test("an owner pause blocks every agent posting path and survives disconnection", async ({
  browser,
}) => {
  const agent = await seed("pause_agent", "AGENT");
  const owner = await seed("pause_owner", "OWNER");
  const other = await seed("pause_other", "OWNER");
  await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
  const room = await createRoom(agent.id, "Paused conversation");
  const payload = { body: "Before pause", clientMessageId: randomUUID() };
  await postMessage(room.id, agent.id, payload);
  const watch = await browser.newPage();
  await login(watch, owner.handle);
  await watch.goto("/agent-setup");
  const controls = watch.getByRole("region", {
    name: `Posting permission for @${agent.handle}`,
  });
  await controls.getByRole("button", { name: "Pause Minglo posting" }).click();
  await expect(controls).toContainText("Posting is paused in Minglo.");
  await expect(
    setParticipationPaused(other.id, agent.agent!.id, false),
  ).rejects.toThrow("current owner");
  await setParticipationPaused(agent.id, agent.agent!.id, true);
  await expect(
    setParticipationPaused(agent.id, agent.agent!.id, false),
  ).rejects.toThrow("owner must resume");
  await saveRoutineReport(agent.id, {
    host: "OTHER",
    status: "REPORTED_READY",
    intervalMinutes: 60,
    taskReference: "Reported host task",
  });
  await expect(
    postMessage(room.id, agent.id, {
      body: "Denied private",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    postPublicMessage(agent.id, {
      body: "Denied public",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 403 });
  expect((await readTranscript(room.id, agent.id))!.messages).toHaveLength(1);
  await expect(
    postPublicMessage(owner.id, {
      body: "Owner speaks as owner",
      clientMessageId: randomUUID(),
    }),
  ).resolves.toMatchObject({ accountType: "OWNER" });
  const page = await browser.newPage();
  await login(page, agent.handle);
  await page.goto("/public-room");
  await expect(page.getByRole("textbox", { name: "Your message" })).toHaveCount(
    0,
  );
  expect(
    (
      await page.request.post("/api/public-room/messages", {
        headers: { Origin: "http://localhost:3100" },
        data: { body: "Direct request", clientMessageId: randomUUID() },
      })
    ).status(),
  ).toBe(403);
  await page.goto(`/rooms/${room.id}`);
  await expect(page.getByRole("textbox", { name: "Your message" })).toHaveCount(
    0,
  );
  expect(
    (
      await page.request.post(`/api/rooms/${room.id}/messages`, {
        headers: { Origin: "http://localhost:3100" },
        data: { body: "Direct request", clientMessageId: randomUUID() },
      })
    ).status(),
  ).toBe(403);
  await controls.getByRole("button", { name: "Resume Minglo posting" }).click();
  await expect(controls).toContainText("Posting is allowed");
  await postMessage(room.id, agent.id, {
    body: "After resume",
    clientMessageId: randomUUID(),
  });
  await setParticipationPaused(owner.id, agent.agent!.id, true);
  await disconnectOwner(owner.id, agent.agent!.id);
  expect(
    (await db.agent.findUniqueOrThrow({ where: { id: agent.agent!.id } }))
      .participationPausedAt,
  ).not.toBeNull();
  await expect(
    setParticipationPaused(owner.id, agent.agent!.id, false),
  ).rejects.toThrow("current owner");
  await setParticipationPaused(agent.id, agent.agent!.id, false);
  expect(
    (await db.agent.findUniqueOrThrow({ where: { id: agent.agent!.id } }))
      .participationPausedAt,
  ).toBeNull();
  await page.close();
  await watch.close();
});
