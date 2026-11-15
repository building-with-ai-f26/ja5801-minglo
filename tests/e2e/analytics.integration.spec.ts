import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { setAnalyticsPreference } from "../../src/lib/analytics/preferences";
import {
  issueClaim,
  consumeClaim,
  disconnectOwner,
} from "../../src/lib/claims";
import {
  collector,
  mockEvents,
  mockRequests,
  setMockFailure,
} from "./analytics-mock";
import { login, logout, password } from "./helpers";
test.beforeAll(async () => {
  await new Promise<void>((resolve) =>
    collector.listen(3150, "127.0.0.1", resolve),
  );
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    collector.close((e) => (e ? reject(e) : resolve())),
  );
  await db.$disconnect();
});
test.beforeEach(() => {
  mockEvents.length = 0;
  mockRequests.length = 0;
  setMockFailure(false);
});
async function seed(type: "OWNER" | "AGENT" = "OWNER", enabled = false) {
  return db.account.create({
    data: {
      handle: `analytic_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      passwordHash: await hash(password),
      type,
      ...(type === "OWNER"
        ? {
            owner: {
              create: {
                displayName: "PRIVATE_PROFILE_TEXT",
                bio: "SECRET_BIO",
              },
            },
          }
        : { agent: { create: { displayName: "Agent" } } }),
      ...(enabled
        ? { analyticsPreference: { create: { enabled: true } } }
        : {}),
    },
    include: { agent: true, owner: true, analyticsPreference: true },
  });
}
test("opt-in is optional, sensitive screens stay quiet and page payloads exclude text and URLs", async ({
  page,
}) => {
  const person = await seed();
  await login(page, person.handle);
  await page.goto("/settings");
  const settings = page.getByRole("region", {
    name: "Usage analytics",
    exact: true,
  });
  await expect(settings.getByRole("checkbox")).not.toBeChecked();
  expect(mockRequests).toHaveLength(0);
  await settings.getByRole("checkbox").check();
  await settings
    .getByRole("button", { name: "Save analytics preference" })
    .click();
  await expect(settings.getByRole("status")).toContainText("saved");
  expect(mockRequests).toHaveLength(0);
  await page.goto(
    "/profiles/" + person.handle + "?SECRET_QUERY=SECRET_QUERY#SECRET_FRAGMENT",
  );
  await expect
    .poll(() => mockEvents.filter((e) => e.event === "page_viewed").length)
    .toBe(1);
  const event = mockEvents.find((e) => e.event === "page_viewed")!;
  expect(event.properties).toMatchObject({
    page_name: "profile",
    account_type: "person",
    capture_source: "browser",
  });
  const all = JSON.stringify(mockEvents);
  expect(all).not.toMatch(
    /SECRET_|PRIVATE_PROFILE_TEXT|\$current_url|\$initial_|referrer/,
  );
  expect(all).not.toContain(person.handle);
  expect(
    mockRequests.every((url) => !/flags|replay|record|survey/.test(url)),
  ).toBe(true);
  const before = mockEvents.length;
  await page.goto("/settings");
  await page.goto("/recover");
  expect(mockEvents.length).toBe(before);
});
test("withdrawal stops collection in another tab and logout does not leak identity into a new account", async ({
  page,
  context,
}) => {
  const a = await seed("OWNER", true);
  const b = await seed("OWNER", true);
  await login(page, a.handle);
  await expect
    .poll(() => mockEvents.filter((e) => e.event === "page_viewed").length)
    .toBeGreaterThan(0);
  const settings = await context.newPage();
  await settings.goto("/settings");
  const control = settings.getByRole("region", {
    name: "Usage analytics",
    exact: true,
  });
  await control.getByRole("checkbox").uncheck();
  await control
    .getByRole("button", { name: "Save analytics preference" })
    .click();
  await expect(control.getByRole("status")).toContainText("saved");
  const before = mockEvents.filter((e) => e.event === "page_viewed").length;
  await page.goto("/discover");
  await expect
    .poll(async () =>
      (await page.request.get("/api/analytics/eligibility")).json(),
    )
    .toBeNull();
  expect(mockEvents.filter((e) => e.event === "page_viewed").length).toBe(
    before,
  );
  await logout(page);
  await login(page, b.handle);
  await expect
    .poll(() =>
      mockEvents.some(
        (e) => e.properties?.distinct_id === b.analyticsPreference!.analyticsId,
      ),
    )
    .toBe(true);
  for (const event of mockEvents.filter((e) => e.event === "$identify"))
    expect(event.properties?.$anon_distinct_id).toBe(
      event.properties?.distinct_id,
    );
  await settings.close();
});
test("owner authorization is per agent and disconnect/reclaim never restores an old opt-in", async ({
  page,
  browser,
}) => {
  const owner = await seed();
  const agent = await seed("AGENT");
  await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
  await login(page, owner.handle);
  await page.goto("/agents");
  const controls = page.getByRole("region", {
    name: "Agent usage analytics",
    exact: true,
  });
  await controls.getByRole("checkbox").check();
  await controls
    .getByRole("button", { name: "Save analytics preference" })
    .click();
  await expect(controls.getByRole("status")).toContainText("saved");
  expect(
    await db.analyticsPreference.count({
      where: { accountId: owner.id, enabled: true },
    }),
  ).toBe(0);
  const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
  try {
    const agentPage = await ctx.newPage();
    await login(agentPage, agent.handle);
    const response = await agentPage.request.get("/api/analytics/eligibility");
    expect(await response.json()).toMatchObject({ accountType: "agent" });
    await agentPage.goto("/settings");
    const own = agentPage.getByRole("region", {
      name: "Usage analytics",
      exact: true,
    });
    await own.getByRole("checkbox").uncheck();
    await own
      .getByRole("button", { name: "Save analytics preference" })
      .click();
    await expect(own.getByRole("status")).toContainText("saved");
    await expect(own.getByRole("checkbox")).toBeDisabled();
    await setAnalyticsPreference(owner.id, true, agent.agent!.id);
    await disconnectOwner(owner.id, agent.agent!.id);
    await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
    expect(
      await (await agentPage.request.get("/api/analytics/eligibility")).json(),
    ).toBeNull();
  } finally {
    await ctx.close();
  }
});
