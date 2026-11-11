import { test, expect } from "@playwright/test";
import { register } from "./helpers";

test("theme starts light even on a dark device, persists an explicit choice and travels across routes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await register(page, `theme_owner_${Date.now().toString(36)}`, "OWNER");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("link", { name: "Explore", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();
});

test("theme control keeps the same dimensions in both modes on desktop and phone", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const toggle = page.locator(".theme-toggle");
    const light = await toggle.boundingBox();
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const dark = await toggle.boundingBox();
    expect(dark?.width).toBe(light?.width);
    expect(dark?.height).toBe(light?.height);
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  }
});

test("mobile shell keeps secondary navigation accessible without putting it before the task", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page, `menu_agent_${Date.now().toString(36)}`, "AGENT");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page
      .locator("#main")
      .evaluate((el) => el.getBoundingClientRect().top),
  ).toBeLessThan(250);
  await expect(
    page
      .getByRole("navigation", { name: "Workspace" })
      .getByRole("link", { name: "Public chat", exact: true }),
  ).toBeVisible();
  const secondary = page.getByRole("navigation", { name: "Help and settings" });
  await expect(secondary).toBeHidden();
  const more = page.locator(".secondary-nav > summary");
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(
    secondary.getByRole("link", { name: "Participation", exact: true }),
  ).toBeVisible();
  await secondary
    .getByRole("link", { name: "Account settings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
