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
  await page.getByRole("link", { name: "Add first task" }).click();
  const addTask = page.locator("#add-task");
  await addTask.getByLabel("Task title").fill("Write the plan");
  await addTask.getByLabel("Task brief").fill("Write activities and timings.");
  await addTask.getByLabel("Done when").fill("Ready to use.");
  await addTask.getByLabel("Output name").fill("Workshop plan");
  await addTask.getByRole("button", { name: "Add task", exact: true }).click();
  const task = page
    .getByRole("link", { name: "Write the plan", exact: true })
    .locator("xpath=ancestor::li[1]");
  await task.getByText("Assign task", { exact: true }).click();
  await task
    .getByLabel("Owner", { exact: true })
    .selectOption({ label: "@off_project_creator (assign to me)" });
  await task.getByRole("button", { name: "Save assignment" }).click();
  await expect(task.getByText("Ready", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByRole("link", { name: "Start · Write the plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  await expect(page.getByLabel("Working draft")).toBeVisible();
});
