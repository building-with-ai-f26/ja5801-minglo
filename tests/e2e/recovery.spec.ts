import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { createRecoveryCodes, recoverAccount } from "../../src/lib/recovery";
import { createRoom } from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { login, password } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});
test("recovery codes are hashed, reset the password once and invalidate existing sessions", async ({
  browser,
}) => {
  const actor = await db.account.create({
    data: {
      handle: `recovery_${Date.now().toString(36)}`,
      type: "AGENT",
      passwordHash: await hash(password),
      agent: { create: { displayName: "Recovery agent" } },
    },
  });
  const room = await createRoom(actor.id, "Recovery keeps history");
  await postMessage(room.id, actor.id, {
    body: "Keep this history",
    clientMessageId: randomUUID(),
  });
  const page = await browser.newPage();
  const otherSession = await browser.newPage();
  await login(page, actor.handle);
  await login(otherSession, actor.handle);
  await page.goto("/settings");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Generate new recovery codes", exact: true })
    .click();
  const codesView = page.locator('[aria-label="New recovery codes"] pre');
  await expect(codesView).toBeVisible();
  const codes = (await codesView.innerText()).trim().split("\n");
  expect(codes).toHaveLength(6);
  const stored = await db.recoveryCode.findMany({
    where: { accountId: actor.id },
  });
  expect(stored).toHaveLength(6);
  for (const row of stored) {
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(codes).not.toContain(row.tokenHash);
  }
  await expect(
    createRecoveryCodes(actor.id, "IncorrectPassword!"),
  ).rejects.toThrow("could not be verified");
  const guest = await browser.newPage();
  const newPassword = "ChangedOnlyForLocalTests_42!";
  await guest.goto("/recover");
  await guest.getByLabel("Handle", { exact: true }).fill(actor.handle);
  await guest.getByLabel("Recovery code", { exact: true }).fill(codes[0]);
  await guest.getByLabel("New password", { exact: true }).fill(newPassword);
  await guest
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(guest).toHaveURL(/\/login\?recovered=1/);
  for (const old of [page, otherSession])
    expect((await old.request.get("/api/public-room/messages")).status()).toBe(
      401,
    );
  expect(
    await db.recoveryCode.count({
      where: { accountId: actor.id, usedAt: null },
    }),
  ).toBe(0);
  await expect(
    recoverAccount(actor.handle, codes[1], password, "test-recovery-old-code"),
  ).rejects.toThrow("could not be verified");
  await guest.getByLabel("Handle", { exact: true }).fill(actor.handle);
  await guest.getByLabel("Password", { exact: true }).fill(password);
  await guest.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    guest.getByRole("alert").filter({ hasText: "Could not sign in" }),
  ).toBeVisible();
  await expect(guest.getByLabel("Handle", { exact: true })).toHaveValue(
    actor.handle,
  );
  await guest.getByLabel("Password", { exact: true }).fill(newPassword);
  await guest.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(guest).toHaveURL(/\/dashboard/);
  await guest.goto(`/rooms/${room.id}`);
  await expect(guest.getByRole("log")).toContainText("Keep this history");
  const fresh = await createRecoveryCodes(actor.id, newPassword);
  const results = await Promise.allSettled([
    recoverAccount(actor.handle, fresh[0], password, "test-recovery-race"),
    recoverAccount(
      actor.handle,
      fresh[0],
      "AnotherLocalTestPassword!",
      "test-recovery-race",
    ),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: actor.id } }))
      .sessionVersion,
  ).toBe(2);
  for (const p of [page, otherSession, guest]) await p.close();
});
