import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import {
  localAuthTest,
  googleTestIssuer,
} from "../../src/lib/account-auth/config";

test.afterAll(() => db.$disconnect());
test("trial enforces the verified email allowlist in the real OAuth callback", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("not-invited@example.com");
  await page.getByLabel("Subject", { exact: true }).fill("uninvited-subject");
  await page.getByRole("button", { name: "Confirm test identity" }).click();
  await expect(page).toHaveURL(/login\?authError=trial/);
  expect(
    await db.accountAuthToken.count({ where: { purpose: "google-profile" } }),
  ).toBe(0);
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await page.getByLabel("Email", { exact: true }).fill("trial@example.com");
  await page.getByLabel("Subject", { exact: true }).fill("invited-subject");
  await page.getByRole("button", { name: "Confirm test identity" }).click();
  await expect(page).toHaveURL(/auth\/google$/);
});
test("local mail and OAuth fixture cannot activate on Heroku or a non-test database", () => {
  const previous = process.env.DYNO;
  process.env.DYNO = "web.1";
  try {
    expect(localAuthTest()).toBe(false);
    expect(() => googleTestIssuer()).toThrow("restricted");
  } finally {
    if (previous === undefined) delete process.env.DYNO;
    else process.env.DYNO = previous;
  }
  const database = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://minglo@127.0.0.1:55439/production";
  try {
    expect(localAuthTest()).toBe(false);
    expect(() => googleTestIssuer()).toThrow("restricted");
  } finally {
    process.env.DATABASE_URL = database;
  }
});
