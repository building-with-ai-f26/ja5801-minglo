import { test, expect, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { structureAccount as account } from "./app-structure-fixtures";
import { login, register, password } from "./helpers";

const welcome = (page: Page) =>
  page.getByRole("region", { name: "Welcome tutorial" });
const dialog = (page: Page) => page.getByRole("dialog");
async function replay(page: Page) {
  await page.locator(".secondary-nav > summary").click();
  await page.getByRole("button", { name: "Take a tour", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
}
async function noSocialMutations(accountId: string) {
  return Promise.all([
    db.follow.count({ where: { followerId: accountId } }),
    db.readPosition.count({ where: { accountId } }),
    db.publicMessage.count({ where: { senderAccountId: accountId } }),
    db.directMessage.count({ where: { senderAccountId: accountId } }),
    db.agentRoutine.count({ where: { agent: { accountId } } }),
    db.claim.count({ where: { agent: { accountId } } }),
  ]);
}

test.afterAll(() => db.$disconnect());

test("new owner gets one optional welcome, finishes six steps and can replay after sign-in", async ({
  page,
}, info) => {
  const handle = `tour_${Date.now().toString(36)}`;
  await register(page, handle, "OWNER");
  await expect(welcome(page)).toBeVisible();
  const viewer = await db.account.findUniqueOrThrow({ where: { handle } });
  const before = await noSocialMutations(viewer.id);
  await welcome(page).getByRole("button", { name: "Show me around" }).click();
  await expect(
    dialog(page).getByRole("heading", { name: "Your starting point." }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("owner-tour-desktop.png") });
  for (let step = 1; step < 6; step++) {
    await expect(dialog(page)).toContainText(`Step ${step} of 6`);
    await dialog(page)
      .getByRole("button", { name: "Next", exact: true })
      .click();
  }
  await expect(dialog(page)).toContainText("does not cancel a task");
  await expect(
    dialog(page).getByRole("button", { name: "Connect my agent" }),
  ).toBeVisible();
  await dialog(page)
    .getByRole("button", { name: "Finish", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (
          await db.accountTourPreference.findUniqueOrThrow({
            where: { accountId: viewer.id },
          })
        ).status,
    )
    .toBe("COMPLETED");
  expect(await noSocialMutations(viewer.id)).toEqual(before);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(welcome(page)).toHaveCount(0);
  await page.context().clearCookies();
  await login(page, handle);
  await expect(welcome(page)).toHaveCount(0);
  await replay(page);
  await expect(dialog(page)).toContainText("Step 1 of 6");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Take a tour", exact: true }),
  ).toBeFocused();
  expect(
    (
      await db.accountTourPreference.findUniqueOrThrow({
        where: { accountId: viewer.id },
      })
    ).status,
  ).toBe("COMPLETED");
});

test("agent replay is role-specific, read-only and restores More; missing targets have a usable fallback", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const viewer = await account("AGENT");
  await login(page, viewer.handle);
  await expect(welcome(page)).toHaveCount(0);
  const before = await noSocialMutations(viewer.id);
  await replay(page);
  await expect(dialog(page)).toContainText("Pick up where you left off.");
  await dialog(page).getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog(page)).toContainText("including retained history");
  await page.screenshot({ path: info.outputPath("agent-tour-mobile.png") });
  await expect(page.locator(".secondary-nav")).toHaveAttribute("open", "");
  await page
    .locator('[data-tour="discover"]')
    .evaluate((element) => element.remove());
  await dialog(page).getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog(page)).toContainText("Find a reason to connect.");
  await expect(page.locator(".tour-spotlight")).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Back", exact: true }).click();
  await expect(dialog(page)).toContainText("Introduce yourself.");
  await page.keyboard.press("Escape");
  await expect(page.locator(".secondary-nav")).toHaveAttribute("open", "");
  await expect(
    page.getByRole("button", { name: "Take a tour", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Take a tour", exact: true }).click();
  for (let step = 1; step < 6; step++)
    await dialog(page)
      .getByRole("button", { name: "Next", exact: true })
      .click();
  await expect(dialog(page)).toContainText(
    "Minglo does not run you in the background",
  );
  await dialog(page)
    .getByRole("button", { name: "Finish", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await db.accountTourPreference.findUniqueOrThrow({
            where: { accountId: viewer.id },
          })
        ).status,
    )
    .toBe("COMPLETED");
  expect(await noSocialMutations(viewer.id)).toEqual(before);
});

test("first-use eligibility defers on a public-chat deep link and skip survives reload", async ({
  page,
}) => {
  const handle = `tour_deep_${Date.now().toString(36)}`;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": "198.18.254.10" });
  await page.goto("/register?next=%2Fpublic-room");
  await page.locator("input[name=type][value=AGENT]").check();
  await page.getByLabel("Display name", { exact: true }).fill(handle);
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/public-room$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const viewer = await db.account.findUniqueOrThrow({ where: { handle } });
  expect(
    (
      await db.accountTourPreference.findUniqueOrThrow({
        where: { accountId: viewer.id },
      })
    ).status,
  ).toBe("UNSEEN");
  await expect(welcome(page)).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(welcome(page)).toBeVisible();
  await expect(welcome(page)).toContainText("manage your participation");
  await welcome(page)
    .getByRole("button", { name: "Skip", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await db.accountTourPreference.findUniqueOrThrow({
            where: { accountId: viewer.id },
          })
        ).status,
    )
    .toBe("SKIPPED");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(welcome(page)).toHaveCount(0);
});

test("only one authenticated tab claims an automatic welcome", async ({
  page,
}) => {
  const viewer = await account();
  await login(page, viewer.handle);
  await db.accountTourPreference.create({ data: { accountId: viewer.id } });
  const second = await page.context().newPage();
  await Promise.all([page.goto("/dashboard"), second.goto("/dashboard")]);
  await expect
    .poll(
      async () =>
        (await welcome(page).count()) + (await welcome(second).count()),
    )
    .toBe(1);
  await second.close();
});
