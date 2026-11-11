import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { createRoom } from "../../src/lib/rooms";
import { login, password } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});
test("links to older private and public messages open authorized bounded context", async ({
  page,
}) => {
  const account = await db.account.create({
    data: {
      handle: `context_${Date.now().toString(36)}`,
      type: "AGENT",
      passwordHash: await hash(password),
      agent: { create: { displayName: "Context agent" } },
    },
    include: { agent: true },
  });
  const room = await createRoom(account.id, "Linked message context");
  await db.message.createMany({
    data: Array.from({ length: 160 }, (_, i) => ({
      roomId: room.id,
      senderAgentId: account.agent!.id,
      body: `Private context ${i}`,
      clientMessageId: randomUUID(),
    })),
  });
  await db.publicMessage.createMany({
    data: Array.from({ length: 160 }, (_, i) => ({
      senderAccountId: account.id,
      body: `Public context ${i}`,
      clientMessageId: randomUUID(),
    })),
  });
  const privateTarget = await db.message.findFirstOrThrow({
    where: { roomId: room.id, body: "Private context 30" },
  });
  const publicTarget = await db.publicMessage.findFirstOrThrow({
    where: { senderAccountId: account.id, body: "Public context 30" },
  });
  await login(page, account.handle);
  await page.goto(
    `/rooms/${room.id}?messageId=${privateTarget.id}#message-${privateTarget.id}`,
  );
  await expect(page.getByRole("log")).toContainText("Private context 30");
  await expect(page.getByRole("log").locator("article")).toHaveCount(50);
  await expect(page.getByRole("log")).not.toContainText("Private context 159");
  await expect(
    page.getByRole("link", {
      name: `Link to message ${privateTarget.id}`,
      exact: true,
    }),
  ).toHaveAttribute(
    "href",
    `/rooms/${room.id}?messageId=${privateTarget.id}#message-${privateTarget.id}`,
  );
  await expect(
    page.getByRole("button", { name: "Load newer messages", exact: true }),
  ).toBeVisible();
  await page.goto(
    `/public-room?messageId=${publicTarget.id}#message-${publicTarget.id}`,
  );
  await expect(page.getByRole("log")).toContainText("Public context 30");
  await expect(page.getByRole("log").locator("article")).toHaveCount(50);
  await expect(page.getByRole("log")).not.toContainText("Public context 159");
  expect(
    (
      await page.request.get(`/api/rooms/${room.id}/messages?around=999999999`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get("/api/public-room/messages?around=999999999")
    ).status(),
  ).toBe(404);
  for (const cursor of ["around=0", "around=1&after=0", "around=NaN"])
    expect(
      (await page.request.get(`/api/public-room/messages?${cursor}`)).status(),
    ).toBe(400);
});
