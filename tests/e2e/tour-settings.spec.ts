import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import { structureAccount as account } from "./app-structure-fixtures";
import { consumeClaim, issueClaim } from "../../src/lib/claims";
import { login } from "./helpers";

test.afterAll(() => db.$disconnect());

test("settings remember the automatic preference and replay works with it off", async ({
  page,
}) => {
  const viewer = await account();
  await login(page, viewer.handle);
  await page.goto("/settings");
  const preference = page.getByRole("checkbox", {
    name: "Show a welcome tutorial automatically",
  });
  await expect(preference).not.toBeChecked();
  await preference.click();
  await expect(preference).toBeEnabled();
  await expect(preference).toBeChecked();
  await page.reload();
  await expect(preference).toBeChecked();
  await preference.click();
  await expect(preference).toBeEnabled();
  await expect(preference).not.toBeChecked();
  await page.getByRole("button", { name: "Replay tour", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Step 1 of 6");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Skip tour" })
    .click();
  await expect(
    page.getByRole("button", { name: "Replay tour", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(preference).not.toBeChecked();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Welcome tutorial" }),
  ).toHaveCount(0);
});

test("failed settings save stays truthful, offers retry and never blocks ordinary navigation", async ({
  page,
}) => {
  const viewer = await account();
  await login(page, viewer.handle);
  await page.goto("/settings");
  await page.route("**/settings", async (route) => {
    if (route.request().headers()["next-action"]) await route.abort();
    else await route.continue();
  });
  const preference = page.getByRole("checkbox", {
    name: "Show a welcome tutorial automatically",
  });
  await preference.click();
  await expect(
    page.getByRole("status").filter({ hasText: "could not be saved" }),
  ).toBeVisible();
  await expect(preference).not.toBeChecked();
  expect(
    await db.accountTourPreference.findUnique({
      where: { accountId: viewer.id },
    }),
  ).toBeNull();
  await page.unroute("**/settings");
  await page.getByRole("button", { name: "Retry tutorial save" }).click();
  await expect(preference).toBeChecked();
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("link", { name: "Messages", exact: true })
    .click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toBeVisible();
});

test("tour actions reject anonymous callers and actor injection, including a connected owner", async ({
  page,
  browser,
}) => {
  const viewer = await account(),
    agent = await account("AGENT");
  await consumeClaim(viewer.id, (await issueClaim(agent.id)).token);
  await login(page, viewer.handle);
  await page.locator(".secondary-nav > summary").click();
  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === "POST" && !!request.headers()["next-action"],
  );
  await page.getByRole("button", { name: "Take a tour", exact: true }).click();
  const request = await requestPromise;
  const headers = {
    "next-action": request.headers()["next-action"],
    "content-type": request.headers()["content-type"],
    origin: new URL(page.url()).origin,
  };
  await expect
    .poll(
      async () =>
        await db.accountTourPreference.count({
          where: { accountId: viewer.id },
        }),
    )
    .toBe(1);
  await page.keyboard.press("Escape");
  const forged = await page.request.post("/dashboard", {
    headers,
    data: JSON.stringify([{ operation: "complete", accountId: agent.id }]),
  });
  expect(await forged.text()).toContain("That tutorial change is unavailable");
  expect(
    await db.accountTourPreference.findUnique({
      where: { accountId: agent.id },
    }),
  ).toBeNull();
  const anonymous = await browser.newContext();
  const response = await anonymous.request.post(
    new URL("/dashboard", page.url()).href,
    { headers, data: JSON.stringify([{ operation: "complete" }]) },
  );
  expect(await response.text()).toContain(
    "Sign in to save your tutorial preference",
  );
  expect(
    (
      await db.accountTourPreference.findUniqueOrThrow({
        where: { accountId: viewer.id },
      })
    ).status,
  ).not.toBe("COMPLETED");
  await anonymous.close();
});

for (const role of ["OWNER", "AGENT"] as const) {
  test(`${role}: plain guide and its correct next action work without JavaScript`, async ({
    browser,
  }) => {
    const viewer = await account(role),
      agent = await account("AGENT");
    if (role === "OWNER")
      await consumeClaim(viewer.id, (await issueClaim(agent.id)).token);
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, viewer.handle);
    await page.goto("/guide");
    const guide = page.getByRole("region", { name: "Quick tour", exact: true });
    await expect(guide.getByRole("listitem")).toHaveCount(6);
    await guide.getByRole("button", { name: "Start my tour" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      role === "OWNER" ? "Your agents, together." : "Introduce yourself.",
    );
    await page.keyboard.press("Escape");
    const noScript = await browser.newContext({
      storageState: await context.storageState(),
      javaScriptEnabled: false,
    });
    const staticPage = await noScript.newPage();
    await staticPage.goto(new URL("/guide", page.url()).href);
    await expect(
      staticPage
        .getByRole("region", { name: "Quick tour", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(6);
    await expect(
      staticPage
        .getByRole("region", { name: "Quick tour", exact: true })
        .getByRole("link", {
          name: role === "OWNER" ? "View my agents" : "Explore conversations",
        }),
    ).toHaveAttribute("href", role === "OWNER" ? "/agents" : "/topics");
    await noScript.close();
    await context.close();
  });
}
