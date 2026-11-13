import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { readPublicTranscript } from "../../src/lib/public-room";
import { login, password } from "./helpers";

async function account(type: "OWNER" | "AGENT" = "OWNER") {
  const handle = `presentation_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  return db.account.create({
    data: {
      handle,
      type,
      passwordHash: await hash(password),
      ...(type === "OWNER"
        ? {
            owner: {
              create: { displayName: "A person with a long display name" },
            },
          }
        : {
            agent: {
              create: { displayName: "An agent with a long display name" },
            },
          }),
    },
  });
}
async function message(
  senderAccountId: string,
  body: string,
  createdAt = new Date(),
  replyToId?: number,
) {
  return db.publicMessage.create({
    data: {
      senderAccountId,
      body,
      createdAt,
      replyToId,
      clientMessageId: randomUUID(),
    },
  });
}
test.use({ hasTouch: true });

test.afterAll(async () => {
  await db.$disconnect();
});

test("public replies quote an authorized parent outside the loaded page, with bounded public fields", async ({
  page,
}) => {
  const author = await account("AGENT");
  const reader = await account();
  const body =
    "Original words <with markup> & a new line.\n" +
    "Long quoted context. ".repeat(30);
  const parent = await message(author.id, body);
  await db.publicMessage.createMany({
    data: Array.from({ length: 55 }, (_, i) => ({
      senderAccountId: author.id,
      body: `Intermediate ${i}`,
      clientMessageId: randomUUID(),
    })),
  });
  const reply = await message(
    reader.id,
    "A reply with context",
    new Date(),
    parent.id,
  );
  const recent = await readPublicTranscript(reader.id, 0, { recent: true });
  expect(recent.messages.some((m) => m.id === parent.id)).toBe(false);
  const quoted = recent.messages.find((m) => m.id === reply.id)!.replyTo!;
  expect(quoted).toEqual({
    id: parent.id,
    body: body.slice(0, 240),
    displayName: "An agent with a long display name",
  });
  expect(Object.keys(quoted).sort()).toEqual(["body", "displayName", "id"]);
  for (const result of [
    await readPublicTranscript(reader.id, parent.id),
    await readPublicTranscript(reader.id, 0, { around: reply.id }),
    await readPublicTranscript(reader.id, 0, { before: reply.id + 1 }),
  ]) {
    expect(result.messages.find((m) => m.id === reply.id)!.replyTo).toEqual(
      quoted,
    );
  }
  await expect(
    readPublicTranscript("missing-account", 0, { recent: true }),
  ).rejects.toMatchObject({ status: 401 });
  await login(page, reader.handle);
  await page.goto("/public-room");
  const row = page.locator(`[data-message-id="${reply.id}"]`);
  const quote = row.locator(".public-message-quote");
  await expect(quote).toContainText("An agent with a long display name");
  await expect(quote).toContainText("Original words <with markup>");
  await expect(quote).toHaveAttribute(
    "href",
    `/public-room?messageId=${parent.id}#message-${parent.id}`,
  );
  expect(await quote.locator("with").count()).toBe(0);
  await quote.click();
  await expect(
    page.locator(`[data-message-id="${parent.id}"] .message-body`),
  ).toHaveText(body);
});

test("public grouping keeps attribution at sender, time, date and loaded-window boundaries", async ({
  page,
}) => {
  const author = await account();
  const other = await account("AGENT");
  const at = (value: string) => new Date(`2026-11-01T${value}:00.000Z`);
  const first = await message(author.id, "First in a group", at("12:00"));
  const next = await message(author.id, "Second in a group", at("12:01"));
  const late = await message(author.id, "After a long gap", at("12:07"));
  const different = await message(other.id, "A different speaker", at("12:08"));
  const back = await message(
    author.id,
    "Original speaker returns",
    at("12:09"),
  );
  const beforeMidnight = await message(
    author.id,
    "Before midnight",
    at("23:59"),
  );
  const afterMidnight = await message(
    author.id,
    "After midnight",
    new Date("2026-11-02T00:00:00.000Z"),
  );
  await login(page, author.handle);
  await page.goto(`/public-room?messageId=${first.id}`);
  for (const id of [
    first.id,
    late.id,
    different.id,
    back.id,
    beforeMidnight.id,
    afterMidnight.id,
  ]) {
    await expect(
      page.locator(`[data-message-id="${id}"] .message-profile-name`),
    ).toBeVisible();
  }
  const continued = page.locator(`[data-message-id="${next.id}"]`);
  await expect(continued.locator(".message-profile-name")).toHaveCount(0);
  await expect(continued.locator(".message-profile-avatar")).toHaveCount(0);
  await expect(continued).toHaveAttribute(
    "aria-label",
    "Message from A person with a long display name",
  );
  await expect(
    continued.getByRole("link", { name: `Link to message ${next.id}` }),
  ).toBeVisible();
  const recent = await readPublicTranscript(author.id, 0, { recent: true });
  await page.goto("/public-room");
  await expect(
    page.locator(
      `[data-message-id="${recent.messages[0].id}"] .message-profile-name`,
    ),
  ).toBeAttached();
});

for (const type of ["OWNER", "AGENT"] as const) {
  test(`${type}: compact actions remain usable by keyboard and touch in both themes`, async ({
    page,
  }, testInfo) => {
    const author = await account(type);
    const parent = await message(
      author.id,
      "Quoted words that should stay easy to read.",
    );
    const reply = await message(
      author.id,
      "A second message with a quote",
      new Date(),
      parent.id,
    );
    await login(page, author.handle);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const theme of ["light", "dark"]) {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 960 });
        await page.goto("/public-room");
        await page.evaluate(
          (theme) => localStorage.setItem("minglo-theme", theme),
          theme,
        );
        await page.reload();
        const row = page.locator(`[data-message-id="${reply.id}"]`);
        const actions = row.getByLabel(`Actions for message ${reply.id}`);
        await expect(
          row.getByRole("button", {
            name: `Reply to message ${reply.id}`,
            exact: true,
          }),
        ).toBeHidden();
        await actions.focus();
        await actions.press("Enter");
        await expect(actions).toHaveCSS("outline-style", "solid");
        await expect(actions).toHaveCSS("outline-width", "2px");
        await expect(
          row.getByRole("button", {
            name: `Reply to message ${reply.id}`,
            exact: true,
          }),
        ).toBeVisible();
        const menuBox = await row
          .locator(".public-message-action-list")
          .boundingBox();
        expect(menuBox!.x).toBeGreaterThanOrEqual(0);
        expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);
        if (width !== 390)
          await row.screenshot({
            path: testInfo.outputPath(`${type}-${theme}-${width}-actions.png`),
          });
        await actions.press("Escape");
        await expect(actions).toBeFocused();
        await expect(row.locator("details")).not.toHaveAttribute("open");
        await actions.tap();
        await page
          .getByLabel("Your message", { exact: true })
          .fill("Keep my draft");
        // Leaving the disclosure closes it; reopen to select Reply.
        await actions.tap();
        await row
          .getByRole("button", {
            name: `Reply to message ${reply.id}`,
            exact: true,
          })
          .click();
        await expect(
          page.getByLabel("Your message", { exact: true }),
        ).toBeFocused();
        await expect(
          page.getByLabel("Your message", { exact: true }),
        ).toHaveValue("Keep my draft");
        await expect(page.locator('input[name="replyToId"]')).toHaveValue(
          String(reply.id),
        );
        await page
          .getByRole("button", { name: "Cancel reply", exact: true })
          .click();
        await expect(page.locator('input[name="replyToId"]')).toHaveValue("");
        await actions.tap();
        await row
          .getByRole("button", {
            name: `Report message ${reply.id}`,
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("region", { name: "Report a message" }),
        ).toBeVisible();
        await expect(page.locator('input[name="messageId"]')).toHaveValue(
          String(reply.id),
        );
        await page
          .getByRole("button", { name: "Cancel report", exact: true })
          .click();
        const box = await actions.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: testInfo.outputPath(`${type}-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
  });
}
