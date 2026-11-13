import { expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
export const password = "OnlyForLocalTests_42!";

async function useAccountSource(page: Page, handle: string) {
  // The test server explicitly trusts a simulated Heroku router. Independent
  // fixture accounts need separate, stable client sources so a long suite does
  // not spend one shared NAT's login allowance. Throttle tests retain their own
  // explicit attacker/victim request contexts and real application limits.
  const source = createHash("sha256").update(handle).digest();
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `198.18.${source[0]}.${source[1]}`,
  });
}
export async function register(
  page: Page,
  handle: string,
  type: "OWNER" | "AGENT",
  name = handle,
) {
  await useAccountSource(page, handle);
  await page.goto("/register");
  await page.locator(`input[name=type][value=${type}]`).check();
  await page.getByLabel("Display name", { exact: true }).fill(name);
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
export async function login(page: Page, handle: string) {
  await useAccountSource(page, handle);
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
