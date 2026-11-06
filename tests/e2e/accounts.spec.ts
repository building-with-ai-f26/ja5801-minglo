import { test, expect } from "@playwright/test";
import { register, login, logout, password } from "./helpers";
import { db } from "../../src/lib/db";
import { issueClaim, consumeClaim, claimHash } from "../../src/lib/claims";
const suffix = Date.now().toString(36);
test.afterAll(async () => {
  await db.$disconnect();
});

for (const type of ["OWNER", "AGENT"] as const)
  test(`${type}: handle-only signup, logout, wrong password, login`, async ({
    page,
  }) => {
    const handle = `${type.toLowerCase()}_${suffix}`;
    await page.goto("/register");
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await register(page, handle, type);
    const stored = await db.account.findUniqueOrThrow({ where: { handle } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain(password);
    await logout(page);
    await page.goto("/login");
    await page.getByLabel("Handle", { exact: true }).fill(handle);
    await page
      .getByLabel("Password", { exact: true })
      .fill("incorrect-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Could not sign in" }),
    ).toBeVisible();
    await login(page, handle.toUpperCase());
  });

test("normalized handles are unique across owner and agent accounts", async ({
  page,
}) => {
  const handle = `unique_${suffix}`;
  await register(page, handle, "OWNER");
  await logout(page);
  await page.goto("/register");
  await page.locator("input[value=AGENT]").check();
  await page.getByLabel("Display name", { exact: true }).fill("Other identity");
  await page.getByLabel("Handle", { exact: true }).fill(handle.toUpperCase());
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "already taken" }),
  ).toBeVisible();
});

test("profile editing, private claim review, confirmation, and single-use link", async ({
  browser,
}) => {
  const agent = await browser.newPage();
  const owner = await browser.newPage();
  const second = await browser.newPage();
  await register(agent, `claim_agent_${suffix}`, "AGENT", "Clover");
  await agent.goto("/profile");
  await agent
    .getByLabel("About you")
    .fill("Curious about design and thoughtful conversations.");
  await agent.getByLabel("Interests", { exact: true }).fill("Design, Nature");
  await agent.getByRole("button", { name: "Save profile" }).click();
  await expect(agent.getByRole("status")).toContainText("saved");
  await agent.getByRole("button", { name: "Create claim link" }).click();
  const link = agent.getByTestId("claim-link");
  await expect(link).toBeVisible();
  const claimUrl = (await link.innerText()).trim();
  await owner.goto(claimUrl);
  await expect(
    owner.getByText("Sign in with your owner account"),
  ).toBeVisible();
  await register(owner, `claim_owner_${suffix}`, "OWNER");
  await owner.goto(claimUrl);
  await expect(
    owner.getByRole("heading", { name: "Room history you’ll gain access to" }),
  ).toBeVisible();
  await expect(
    owner.getByText("Curious about design and thoughtful conversations."),
  ).toBeVisible();
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Confirm and claim agent" }).click();
  await expect(owner).toHaveURL(/claimed=1/);
  await register(second, `claim_second_${suffix}`, "OWNER");
  await second.goto(claimUrl);
  await expect(
    second.getByRole("heading", { name: /expired or was already used/ }),
  ).toBeVisible();
  await agent.close();
  await owner.close();
  await second.close();
});

test("claim tokens are hashed, expire, rotate, and have one winner under concurrent redemption", async () => {
  const accounts = await Promise.all(
    ["AGENT", "OWNER", "OWNER"].map((type, i) =>
      db.account.create({
        data: {
          handle: `atomic_${i}_${suffix}`,
          type: type as "AGENT" | "OWNER",
          passwordHash: "not-a-login-hash",
          ...(type === "AGENT"
            ? { agent: { create: { displayName: "Atomic" } } }
            : { owner: { create: { displayName: "Owner" } } }),
        },
      }),
    ),
  );
  const first = await issueClaim(accounts[0].id);
  const stored = await db.claim.findUniqueOrThrow({
    where: { tokenHash: claimHash(first.token) },
  });
  expect(stored.tokenHash).not.toBe(first.token);
  await db.claim.update({
    where: { id: stored.id },
    data: { expiresAt: new Date(0) },
  });
  await expect(consumeClaim(accounts[1].id, first.token)).rejects.toThrow(
    /expired/,
  );
  const rotated = await issueClaim(accounts[0].id);
  await expect(consumeClaim(accounts[1].id, first.token)).rejects.toThrow(
    /invalid|expired/,
  );
  const results = await Promise.allSettled([
    consumeClaim(accounts[1].id, rotated.token),
    consumeClaim(accounts[2].id, rotated.token),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});
