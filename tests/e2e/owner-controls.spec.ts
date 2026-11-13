import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import {
  issueClaim,
  consumeClaim,
  claimHash,
  disconnectOwner,
} from "../../src/lib/claims";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
  readTranscript,
} from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
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

test("owner disconnection ends derived access, retains creator rights, and invalidates pending claims", async ({
  page,
}) => {
  const agent = await seed("disconnect_agent", "AGENT");
  const owner = await seed("disconnect_owner", "OWNER");
  const other = await seed("disconnect_other", "OWNER");
  const creator = await seed("disconnect_host", "AGENT");
  await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
  const rooms = [
    await createRoom(creator.id, "Other creator"),
    await createRoom(owner.id, "Owner created"),
  ];
  for (const room of rooms) {
    await inviteAgent(room.creatorAccountId, room.id, agent.handle);
    const membership = await db.membership.findFirstOrThrow({
      where: { roomId: room.id, agentId: agent.agent!.id },
    });
    await respondToInvitation(agent.id, membership.id, true);
    await postMessage(room.id, agent.id, {
      body: "Keep authorship and history",
      clientMessageId: randomUUID(),
    });
  }
  const stale = randomBytes(32).toString("base64url");
  await db.claim.create({
    data: {
      agentId: agent.agent!.id,
      tokenHash: claimHash(stale),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await expect(disconnectOwner(other.id, agent.agent!.id)).rejects.toThrow(
    "current owner",
  );
  await login(page, owner.handle);
  await page.goto("/agents");
  await page
    .locator("summary")
    .filter({ hasText: "Disconnect owner relationship" })
    .click();
  await page.getByLabel("I understand which owner access ends.").check();
  await page
    .getByRole("button", { name: "Disconnect owner", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await db.agent.findUniqueOrThrow({ where: { id: agent.agent!.id } }))
          .ownerId,
    )
    .toBeNull();
  await page.reload();
  await expect(page.getByText("No agents claimed yet.")).toBeVisible();
  expect(await readTranscript(rooms[0].id, owner.id)).toBeNull();
  expect(
    (await page.request.get(`/api/rooms/${rooms[0].id}/messages`)).status(),
  ).toBe(404);
  expect((await readTranscript(rooms[1].id, owner.id))!.messages).toHaveLength(
    1,
  );
  expect((await readTranscript(rooms[0].id, agent.id))!.messages).toHaveLength(
    1,
  );
  await expect(consumeClaim(other.id, stale)).rejects.toThrow("invalid");
  await consumeClaim(other.id, (await issueClaim(agent.id)).token);
  await expect(disconnectOwner(owner.id, agent.agent!.id)).rejects.toThrow(
    "current owner",
  );
  await disconnectOwner(agent.id, agent.agent!.id);
  expect(
    (await db.agent.findUniqueOrThrow({ where: { id: agent.agent!.id } }))
      .ownerId,
  ).toBeNull();
  expect(
    await db.message.count({ where: { senderAgentId: agent.agent!.id } }),
  ).toBe(2);
});
