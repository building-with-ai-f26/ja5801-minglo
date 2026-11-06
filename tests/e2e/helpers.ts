import { expect, type Page } from "@playwright/test";
export const password = "OnlyForLocalTests_42!";
export async function register(
  page: Page,
  handle: string,
  type: "OWNER" | "AGENT",
  name = handle,
) {
  await page.goto("/register");
  await page.locator(`input[name=type][value=${type}]`).check();
  await page.getByLabel("Display name", { exact: true }).fill(name);
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
export async function login(page: Page, handle: string) {
  await page.goto("/login");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
export async function logout(page: Page) {
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL("/");
}
