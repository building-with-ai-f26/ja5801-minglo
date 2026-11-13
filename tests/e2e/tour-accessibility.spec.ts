import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import { structureAccount as account } from "./app-structure-fixtures";
import { login } from "./helpers";

test.afterAll(() => db.$disconnect());
for (const role of ["OWNER", "AGENT"] as const) {
  test(`${role}: both themes fit six steps at phone/desktop sizes with keyboard and reduced motion`, async ({
    page,
  }, info) => {
    test.setTimeout(180_000);
    const viewer = await account(role);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page, viewer.handle);
    await page.goto("/discover");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
        localStorage.setItem("minglo-theme", value);
      }, theme);
      for (const width of [320, 360, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator(".secondary-nav > summary").click();
        const launch = page.getByRole("button", {
          name: "Take a tour",
          exact: true,
        });
        await launch.click();
        const modal = page.getByRole("dialog");
        await expect(modal).toBeVisible();
        await expect(page.locator(".secondary-nav")).not.toHaveAttribute(
          "open",
          "",
        );
        for (let step = 1; step <= 6; step++) {
          await expect(modal).toContainText(`Step ${step} of 6`);
          const panel = page.locator(".tour-panel");
          await expect
            .poll(async () =>
              panel.evaluate((element) => {
                const r = element.getBoundingClientRect();
                return (
                  r.left >= 0 &&
                  r.right <= innerWidth &&
                  r.top >= 0 &&
                  r.bottom <= innerHeight &&
                  element.scrollWidth <= element.clientWidth
                );
              }),
            )
            .toBe(true);
          for (const button of await modal.getByRole("button").all()) {
            const rect = await button.boundingBox();
            expect(rect!.height).toBeGreaterThanOrEqual(44);
          }
          await page.screenshot({
            path: info.outputPath(`${role}-${theme}-${width}-step-${step}.png`),
          });
          if (step < 6)
            await modal
              .getByRole("button", { name: "Next", exact: true })
              .click();
        }
        // Native modal containment keeps normal workspace links out of Tab order.
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
          expect(
            await page.evaluate(
              () => !!document.activeElement?.closest("dialog"),
            ),
          ).toBe(true);
        }
        await page.keyboard.press("Escape");
        await expect(modal).toHaveCount(0);
        await expect(launch).toBeFocused();
        await expect(page.locator(".secondary-nav")).toHaveAttribute(
          "open",
          "",
        );
        await page.locator(".secondary-nav > summary").click();
      }
    }
    // 200% layout zoom equivalent: 1440px desktop has a 720 CSS-pixel viewport.
    await page.setViewportSize({ width: 720, height: 450 });
    await page.locator(".secondary-nav > summary").click();
    await page
      .getByRole("button", { name: "Take a tour", exact: true })
      .click();
    for (let step = 1; step < 6; step++)
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Next", exact: true })
        .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Finish", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Finish", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${role}-200-percent-layout.png`),
    });
    await page.keyboard.press("Escape");
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("a failed automatic offer stays unobtrusive and manual replay still works", async ({
  page,
}) => {
  const viewer = await account();
  await login(page, viewer.handle);
  await db.accountTourPreference.create({ data: { accountId: viewer.id } });
  let rejected = 0;
  await page.route("**/dashboard", async (route) => {
    if (route.request().headers()["next-action"]) {
      rejected++;
      await route.abort();
    } else await route.continue();
  });
  await page.reload();
  await expect.poll(() => rejected).toBe(1);
  await expect(
    page.getByRole("region", { name: "Welcome tutorial" }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.unroute("**/dashboard");
  await page.locator(".secondary-nav > summary").click();
  await page.getByRole("button", { name: "Take a tour", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("route departure and account switching close the tour and select the next account's guide", async ({
  page,
}) => {
  const owner = await account(),
    agent = await account("AGENT");
  await login(page, owner.handle);
  await page.goto("/discover");
  await page.locator(".secondary-nav > summary").click();
  await page.getByRole("button", { name: "Take a tour", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.context().clearCookies();
  await login(page, agent.handle);
  await page.locator(".secondary-nav > summary").click();
  await page.getByRole("button", { name: "Take a tour", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Pick up where you left off.",
  );
  await page.keyboard.press("Escape");
  expect(
    await db.accountTourPreference.findUnique({
      where: { accountId: owner.id },
    }),
  ).not.toMatchObject({ status: "COMPLETED" });
});
