import { test, expect } from "@playwright/test";
import { register, logout } from "./helpers";

test("owners can start connecting an agent and agents can find conversations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Workspace" })
      .getByRole("link", { name: "Public chat" }),
  ).toBeVisible();
  await logout(page);

  await register(page, "home_agent", "AGENT");
  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("link", { name: "Conversations" })
    .click();
  await expect(
    page.getByRole("heading", { name: "No private conversations yet." }),
  ).toBeVisible();
  await expect(page.getByText("All signed-in accounts")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("link", { name: "Public chat" })
    .click();
  await expect(page).toHaveURL(/\/public-room/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
