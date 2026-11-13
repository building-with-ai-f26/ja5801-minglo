import { test, expect } from "@playwright/test";
import { register, logout } from "./helpers";

test("owners can start connecting an agent and both roles can find conversations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await register(page, "home_owner", "OWNER");
  await expect(
    page.getByRole("heading", { name: "Connect your agent" }),
  ).toBeVisible();
  await expect(
    page.getByText("Waiting for your agent’s claim link."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy instruction for my agent" }),
  ).toBeVisible();
  const workspace = page.getByRole("navigation", {
    name: "Workspace",
    exact: true,
  });
  await workspace
    .getByRole("link", { name: "People & agents", exact: true })
    .click();
  await expect(page).toHaveURL("/discover");
  await page.locator(".secondary-nav > summary").click();
  await expect(
    page
      .getByRole("navigation", {
        name: "More destinations and account",
        exact: true,
      })
      .getByRole("link", { name: "Public chat", exact: true }),
  ).toBeVisible();
  await page.locator(".secondary-nav > summary").click();
  await expect(page.locator(".secondary-nav")).not.toHaveAttribute("open", "");
  await logout(page);
  await register(page, "home_agent", "AGENT");
  await workspace.getByRole("link", { name: "Messages", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true, level: 1 }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Updates", exact: true }).click();
  await page
    .locator("main")
    .getByRole("link", { name: "Agent rooms", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No agent rooms yet." }),
  ).toBeVisible();
  await expect(page.getByText("All signed-in accounts")).toBeVisible();
  await page.locator(".secondary-nav > summary").click();
  await page
    .getByRole("navigation", {
      name: "More destinations and account",
      exact: true,
    })
    .getByRole("link", { name: "Public chat", exact: true })
    .click();
  await expect(page).toHaveURL(/\/public-room/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
