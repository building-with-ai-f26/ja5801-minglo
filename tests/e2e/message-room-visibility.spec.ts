import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import { consumeClaim, issueClaim } from "../../src/lib/claims";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
} from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { randomUUID } from "node:crypto";
import {
  structureAccount as account,
  structureChat as chat,
} from "./app-structure-fixtures";
import { login } from "./helpers";

test.afterAll(() => db.$disconnect());

test("Messages shows a connected agent's existing room beside direct chats and opens its read-only history", async ({
  page,
}, info) => {
  const owner = await account();
  const cortana = await account("AGENT", "Cortana fixture");
  const lyra = await account("AGENT", "Lyra fixture");
  await consumeClaim(owner.id, (await issueClaim(cortana.id)).token);
  const room = await createRoom(
    cortana.id,
    "Cortana × Lyra — first hangout fixture",
  );
  await inviteAgent(cortana.id, room.id, lyra.handle);
  const invitation = await db.membership.findUniqueOrThrow({
    where: { roomId_agentId: { roomId: room.id, agentId: lyra.agent!.id } },
  });
  await respondToInvitation(lyra.id, invitation.id, true);
  await postMessage(room.id, cortana.id, {
    body: "An existing room conversation remains discoverable",
    clientMessageId: randomUUID(),
  });
  await postMessage(room.id, lyra.id, {
    body: "A room reply from Lyra",
    clientMessageId: randomUUID(),
  });
  const direct = await chat(
    cortana.id,
    (await account()).id,
    "A separate direct exchange",
    "ACTIVE",
  );
  await login(page, owner.handle);
  await page.goto("/inbox");
  const group = page.getByRole("region", {
    name: "Your agents’ chats",
    exact: true,
  });
  const card = group.locator(`a[href="/rooms/${room.id}"]`);
  await expect(card).toContainText(room.title);
  await expect(card).toContainText("Agent room");
  await expect(card).toContainText("Read only");
  await expect(group.locator(`a[href="/messages/${direct.id}"]`)).toBeVisible();
  expect(
    await db.readPosition.count({
      where: { accountId: { in: [owner.id, cortana.id] } },
    }),
  ).toBe(0);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      localStorage.setItem("minglo-theme", value);
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`message-room-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  }
  await card.click();
  await expect(page).toHaveURL(`/rooms/${room.id}`);
  await expect(page.getByRole("log")).toContainText("A room reply from Lyra");
  await expect(page.getByLabel("Your message", { exact: true })).toHaveCount(0);
  expect(
    await db.readPosition.count({ where: { accountId: cortana.id } }),
  ).toBe(0);
  await page.goto(`/inbox?agent=${cortana.agent!.id}`);
  await expect(group.locator(`a[href="/rooms/${room.id}"]`)).toBeVisible();
});
