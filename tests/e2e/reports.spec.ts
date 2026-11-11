import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "../../src/lib/db";
import { createRoom } from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import { reportMessage } from "../../src/lib/reports";
import { login, password } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});
test("reports require current access, persist once and have an operator review path", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const actor = await db.account.create({
    data: {
      handle: `reporter_${suffix}`,
      type: "AGENT",
      passwordHash: await hash(password),
      agent: { create: { displayName: "Reporter" } },
    },
  });
  const outsider = await db.account.create({
    data: {
      handle: `report_out_${suffix}`,
      type: "OWNER",
      passwordHash: "not-for-login",
      owner: { create: { displayName: "Outsider" } },
    },
  });
  const room = await createRoom(actor.id, "Report review fixture");
  const message = await postMessage(room.id, actor.id, {
    body: "Private body excluded from operator listing",
    clientMessageId: randomUUID(),
  });
  await expect(
    reportMessage(
      outsider.id,
      `private:${room.id}`,
      message.id,
      "I should not have access",
    ),
  ).rejects.toThrow("unavailable");
  await login(page, actor.handle);
  await page.goto(`/rooms/${room.id}`);
  await page
    .getByRole("button", { name: `Report message ${message.id}`, exact: true })
    .click();
  await page
    .getByLabel("What should be reviewed?")
    .fill("Please review this local test report.");
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Report saved for operator review" }),
  ).toBeVisible();
  const report = await db.messageReport.findFirstOrThrow({
    where: {
      reporterAccountId: actor.id,
      messageId: message.id,
      conversationKey: `private:${room.id}`,
    },
  });
  expect(
    (
      await reportMessage(
        actor.id,
        `private:${room.id}`,
        message.id,
        "Repeated local test report",
      )
    ).id,
  ).toBe(report.id);
  const run = promisify(execFile);
  const env = {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
  };
  const listing = await run(
    process.execPath,
    ["scripts/review-reports.mjs", "--list"],
    { env },
  );
  expect(
    JSON.parse(listing.stdout).some(
      (row: { id: string }) => row.id === report.id,
    ),
  ).toBe(true);
  expect(listing.stdout).not.toContain(message.body);
  await run(
    process.execPath,
    [
      "scripts/review-reports.mjs",
      "--resolve",
      report.id,
      "--note",
      "Reviewed local fixture; no action required.",
    ],
    { env },
  );
  expect(
    (await db.messageReport.findUniqueOrThrow({ where: { id: report.id } }))
      .resolvedAt,
  ).not.toBeNull();
});
test("concurrent duplicate reports spend one quota slot; report flooding is bounded", async () => {
  const actor = await db.account.create({
    data: {
      handle: `report_limit_${Date.now().toString(36)}`,
      type: "OWNER",
      passwordHash: "not-for-login",
      owner: { create: { displayName: "Report limits" } },
    },
  });
  const messages: Awaited<ReturnType<typeof postPublicMessage>>[] = [];
  for (let i = 0; i < 11; i++)
    messages.push(
      await postPublicMessage(actor.id, {
        body: `Report limit fixture ${i}`,
        clientMessageId: randomUUID(),
      }),
    );
  const duplicates = await Promise.all(
    Array.from({ length: 5 }, () =>
      reportMessage(
        actor.id,
        "public",
        messages[0].id,
        "Concurrent fixture report",
      ),
    ),
  );
  expect(new Set(duplicates.map((r) => r.id)).size).toBe(1);
  for (const message of messages.slice(1, 10))
    await reportMessage(
      actor.id,
      "public",
      message.id,
      "Review fixture message",
    );
  await expect(
    reportMessage(
      actor.id,
      "public",
      messages[10].id,
      "Over quota fixture report",
    ),
  ).rejects.toThrow("Too many reports");
  expect(
    await db.messageReport.count({ where: { reporterAccountId: actor.id } }),
  ).toBe(10);
});
