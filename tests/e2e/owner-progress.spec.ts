import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
} from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import { removeParticipant } from "../../src/lib/room-controls";
import { issueClaim, consumeClaim } from "../../src/lib/claims";
import { login, password } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});
test("owner progress shows actual contributions and removes revoked private excerpts", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const accounts = await Promise.all(
    ["owner", "agent", "host"].map(async (label) =>
      db.account.create({
        data: {
          handle: `progress_${label}_${suffix}`,
          passwordHash: await hash(password),
          type: label === "owner" ? "OWNER" : "AGENT",
          ...(label === "owner"
            ? { owner: { create: { displayName: label } } }
            : { agent: { create: { displayName: label } } }),
        },
        include: { agent: true },
      }),
    ),
  );
  const [owner, agent, host] = accounts;
  await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, owner.handle);
  const progress = page.getByRole("article", {
    name: `Latest contribution from @${agent.handle}`,
  });
  const participation = page.getByRole("complementary", {
    name: "Agent participation",
  });
  await expect(
    participation.getByText("Connected to you", { exact: true }),
  ).toBeVisible();
  await expect(
    participation.getByText("No host-task check-in recorded yet.", {
      exact: true,
    }),
  ).toBeVisible();
  const room = await createRoom(host.id, "Progress private fixture");
  await inviteAgent(host.id, room.id, agent.handle);
  const membership = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: agent.agent!.id },
  });
  await respondToInvitation(agent.id, membership.id, true);
  const parent = await postMessage(room.id, host.id, {
    body: "A private question from the other agent",
    clientMessageId: randomUUID(),
  });
  const reply = await postMessage(room.id, agent.id, {
    body: "Private progress excerpt",
    clientMessageId: randomUUID(),
    replyToId: parent.id,
  });
  await page.reload();
  await expect(
    progress.getByText("A private question from the other agent", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    progress.getByText("Private progress excerpt", { exact: true }),
  ).toBeVisible();
  const foreignRoom = await createRoom(
    host.id,
    "Private parent outside owner access",
  );
  const foreign = await postMessage(foreignRoom.id, host.id, {
    body: "Foreign parent must stay secret",
    clientMessageId: randomUUID(),
  });
  await db.message.update({
    where: { id: reply.id },
    data: { replyToId: foreign.id },
  });
  await page.reload();
  await expect(
    progress.getByText("Private progress excerpt", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Foreign parent must stay secret", { exact: true }),
  ).toHaveCount(0);
  await db.message.update({
    where: { id: reply.id },
    data: { replyToId: parent.id },
  });
  await removeParticipant(host.id, room.id, agent.agent!.id);
  await page.reload();
  await expect(
    page.getByText("Private progress excerpt", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("A private question from the other agent", { exact: true }),
  ).toHaveCount(0);
  const publicParent = await postPublicMessage(owner.id, {
    body: "A public question from a person",
    clientMessageId: randomUUID(),
  });
  const message = await postPublicMessage(agent.id, {
    body: "Public progress contribution",
    clientMessageId: randomUUID(),
    replyToId: publicParent.id,
  });
  await page.reload();
  await expect(
    progress.getByRole("link", { name: "Read the conversation" }),
  ).toHaveAttribute(
    "href",
    `/public-room?messageId=${message.id}#message-${message.id}`,
  );
  await expect(
    progress.getByText("A public question from a person", { exact: true }),
  ).toBeVisible();
  await participation
    .getByRole("button", { name: "Pause Minglo posting", exact: true })
    .click();
  await expect(
    participation.getByText("Posting is paused in Minglo.", { exact: true }),
  ).toBeVisible();
  await expect(
    postPublicMessage(agent.id, {
      body: "A paused Home control must enforce permission",
      clientMessageId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 403 });
  await participation
    .getByRole("button", { name: "Resume Minglo posting", exact: true })
    .click();
  await expect(
    participation.getByText("Posting allowed within your permissions.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
