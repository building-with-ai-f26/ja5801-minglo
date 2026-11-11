import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { setBlocked } from "../../src/lib/blocks";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
  readTranscript,
} from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { getAttention } from "../../src/lib/inbox";
import { login, password } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});
test("blocking stops new invitations and direct attention without changing shared access", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const [a, b] = await Promise.all(
    ["block_a", "block_b"].map(async (label) =>
      db.account.create({
        data: {
          handle: `${label}_${suffix}`,
          type: "AGENT",
          passwordHash: await hash(password),
          agent: { create: { displayName: label } },
        },
        include: { agent: true },
      }),
    ),
  );
  const room = await createRoom(a.id, "Shared blocked conversation");
  await setBlocked(b.id, a.id, true);
  await setBlocked(b.id, a.id, true);
  expect(
    await db.accountBlock.count({
      where: { blockerAccountId: b.id, targetAccountId: a.id },
    }),
  ).toBe(1);
  await expect(inviteAgent(a.id, room.id, b.handle)).rejects.toThrow(
    "account preferences",
  );
  await expect(setBlocked(b.id, b.id, true)).rejects.toThrow("yourself");
  await setBlocked(b.id, a.id, false);
  await inviteAgent(a.id, room.id, b.handle);
  const membership = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: b.agent!.id },
  });
  await respondToInvitation(b.id, membership.id, true);
  await postMessage(room.id, a.id, {
    body: `Before block @${b.handle}`,
    clientMessageId: randomUUID(),
  });
  expect((await getAttention(b.id)).some((i) => i.kind === "MENTION")).toBe(
    true,
  );
  await login(page, b.handle);
  await page.goto(`/profiles/${a.handle}`);
  const controls = page.getByRole("region", {
    name: "Account controls",
    exact: true,
  });
  await controls.locator("summary").click();
  await controls
    .getByRole("button", { name: `Block @${a.handle}`, exact: true })
    .click();
  await expect
    .poll(async () =>
      db.accountBlock.count({
        where: { blockerAccountId: b.id, targetAccountId: a.id },
      }),
    )
    .toBe(1);
  expect(await getAttention(b.id)).toHaveLength(0);
  const before = await db.attentionItem.count({
    where: { recipientAccountId: b.id },
  });
  await postMessage(room.id, a.id, {
    body: `Shared history remains @${b.handle}`,
    clientMessageId: randomUUID(),
  });
  expect(
    await db.attentionItem.count({ where: { recipientAccountId: b.id } }),
  ).toBe(before);
  expect((await readTranscript(room.id, b.id))!.messages).toHaveLength(2);
  const otherRoom = await createRoom(a.id, "No new blocked invitation");
  await expect(inviteAgent(a.id, otherRoom.id, b.handle)).rejects.toThrow(
    "account preferences",
  );
  await setBlocked(b.id, a.id, false);
  await setBlocked(a.id, b.id, true);
  await expect(inviteAgent(a.id, otherRoom.id, b.handle)).rejects.toThrow(
    "account preferences",
  );
});
