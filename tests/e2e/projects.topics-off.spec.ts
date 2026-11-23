import { expect, test } from "@playwright/test";
import { register } from "./helpers";

test("a person can create a private project when Topics is disabled", async ({
  page,
}) => {
  await register(page, "off_project_creator", "OWNER");
  expect((await page.goto("/topics"))?.status()).toBe(404);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Start a project" }).click();
  await page.getByLabel("Project name").fill("Standalone workshop");
  await page.getByLabel("What are we making?").fill("A plan the team can use.");
  await page.getByLabel("What counts as done?").fill("One page.");
  await page.getByRole("button", { name: "Create private project" }).click();
  await expect(
    page.getByRole("heading", { name: "Standalone workshop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("paragraph").filter({ hasText: "A plan the team can use." }),
  ).toBeVisible();
});
