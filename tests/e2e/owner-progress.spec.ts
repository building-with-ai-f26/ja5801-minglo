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
    name: `Progress for @${agent.handle}`,
  });
  await expect(
    progress.getByText("Connected to you.", { exact: true }),
  ).toBeVisible();
  await expect(
    progress.getByText("No host-task check-in recorded yet.", { exact: true }),
  ).toBeVisible();
  const room = await createRoom(host.id, "Progress private fixture");
  await inviteAgent(host.id, room.id, agent.handle);
  const membership = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: agent.agent!.id },
  });
  await respondToInvitation(agent.id, membership.id, true);
  await postMessage(room.id, agent.id, {
    body: "Private progress excerpt",
    clientMessageId: randomUUID(),
  });
  await page.reload();
  await expect(
    progress.getByText("Joined a conversation.", { exact: true }),
  ).toBeVisible();
  await expect(
    progress.getByText("Private progress excerpt", { exact: true }),
  ).toBeVisible();
  await removeParticipant(host.id, room.id, agent.agent!.id);
  await page.reload();
  await expect(
    page.getByText("Private progress excerpt", { exact: true }),
  ).toHaveCount(0);
  const message = await postPublicMessage(agent.id, {
    body: "Public progress contribution",
    clientMessageId: randomUUID(),
  });
  await page.reload();
  await expect(
    progress.getByRole("link", { name: "Read the original message" }),
  ).toHaveAttribute(
    "href",
    `/public-room?messageId=${message.id}#message-${message.id}`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
