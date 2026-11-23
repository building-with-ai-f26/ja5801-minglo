import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { hash } from "argon2";
import { db } from "../../src/lib/db";
import { login, logout, password } from "./helpers";
import {
  googleProfileProof,
  linkGoogle,
  requestEmailVerification,
  resetEmailPassword,
  verifyRecoveryEmail,
  requireRecent,
  createGoogleAccount,
  tokenDigest,
} from "../../src/lib/account-auth/service";
import { createRecoveryCodes } from "../../src/lib/recovery";
const hashed = hash(password);
const unique = () => randomUUID().replaceAll("-", "").slice(0, 15);
async function human(
  overrides: {
    recoveryEmail?: string;
    type?: "OWNER" | "AGENT";
    old?: boolean;
  } = {},
) {
  const type = overrides.type ?? "OWNER";
  return db.account.create({
    data: {
      handle: `auth_${unique()}`,
      passwordHash: await hashed,
      type,
      recoveryEmail: overrides.recoveryEmail,
      emailVerifiedAt: overrides.recoveryEmail ? new Date() : undefined,
      createdAt: overrides.old ? new Date("2026-01-01") : undefined,
      ...(type === "OWNER"
        ? { owner: { create: { displayName: "Alex" } } }
        : { agent: { create: { displayName: "Test agent" } } }),
    },
  });
}
async function google(
  page: Page,
  email: string,
  subject: string,
  options: { unverified?: boolean; badNonce?: boolean; cancel?: boolean } = {},
) {
  await expect(page).toHaveURL(/127\.0\.0\.1:3161\/authorize/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Subject", { exact: true }).fill(subject);
  if (options.unverified) await page.getByLabel("Unverified email").check();
  if (options.badNonce) await page.getByLabel("Wrong nonce").check();
  await page
    .getByRole("button", {
      name: options.cancel ? "Cancel" : "Confirm test identity",
      exact: true,
    })
    .click();
}
async function mailLink(email: string, pathname: string) {
  let link = "";
  await expect
    .poll(async () => {
      const files = await readdir(".local/auth-mail").catch(() => []);
      for (const file of files) {
        const message = JSON.parse(
          await readFile(`.local/auth-mail/${file}`, "utf8"),
        );
        if (message.to.includes(email) && message.text.includes(pathname))
          link = message.text.match(/http[^\s]+/)?.[0] ?? "";
      }
      return link;
    })
    .not.toBe("");
  return link;
}
test.afterAll(() => db.$disconnect());

test("existing owner connects Google without changing identity; provider login and disconnect retain history", async ({
  page,
}) => {
  const account = await human();
  const subject = unique();
  await db.publicMessage.create({
    data: {
      senderAccountId: account.id,
      body: "Retain my message",
      clientMessageId: randomUUID(),
    },
  });
  await login(page, account.handle);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Sign in with Google", exact: true })
    .click();
  await google(page, `${unique()}@example.com`, subject);
  await expect(page).toHaveURL(/settings\?connected=1/);
  expect(
    (await db.signInIdentity.findFirstOrThrow({ where: { subject } }))
      .accountId,
  ).toBe(account.id);
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: account.id } }))
      .recoveryEmail,
  ).toBeNull();
  await logout(page);
  await page.goto("/login?next=%2Fpublic-room");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await google(page, `${unique()}@example.com`, subject);
  await expect(page).toHaveURL(/\/public-room$/);
  await expect(page.getByRole("log")).toContainText("Retain my message");
  await page.goto("/settings");
  await page
    .locator("summary")
    .filter({ hasText: /^Disconnect Google$/ })
    .click();
  await page
    .getByRole("button", { name: "Disconnect Google", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await db.signInIdentity.count({ where: { accountId: account.id } }),
  ).toBe(0);
  await login(page, account.handle);
  expect(
    await db.publicMessage.count({ where: { senderAccountId: account.id } }),
  ).toBe(1);
});

test("new Google identity offers existing-account linking before explicit passwordless registration", async ({
  page,
}) => {
  const email = `${unique()}@example.com`,
    subject = unique(),
    handle = `google_${unique()}`;
  await page.goto("/login?next=%2Fpublic-room");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await google(page, email, subject);
  await expect(page).toHaveURL(/\/auth\/google$/);
  await expect(
    page.getByRole("link", { name: "Connect an existing account" }),
  ).toBeVisible();
  expect(await db.signInIdentity.count({ where: { subject } })).toBe(0);
  await page
    .getByText("I'm new to Minglo — create an account", { exact: true })
    .click();
  await page.getByLabel("Display name", { exact: true }).fill("New person");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByRole("button", { name: "Create my Minglo account" }).click();
  await expect(page).toHaveURL(/\/public-room$/);
  const account = await db.account.findUniqueOrThrow({
    where: { handle },
    include: { analyticsPreference: true, tourPreference: true },
  });
  expect(account.passwordHash).toBeNull();
  expect(account.recoveryEmail).toBe(email);
  expect(account.analyticsPreference).toBeNull();
  expect(account.tourPreference).not.toBeNull();
  await page.goto("/settings");
  await page
    .locator("summary")
    .filter({ hasText: /^Disconnect Google$/ })
    .click();
  await page
    .getByRole("button", { name: "Disconnect Google", exact: true })
    .click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Set a password",
  );
  await page
    .getByRole("button", { name: "Generate new recovery codes" })
    .click();
  await expect(
    page.locator('[aria-label="New recovery codes"] pre'),
  ).toBeVisible();
  await page.getByText("Set a password", { exact: true }).click();
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password").fill(password);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/login\?recovered=1/);
  await login(page, handle);
});

test("unlinked Google can connect after authenticating an existing Minglo account", async ({
  page,
}) => {
  const account = await human(),
    subject = unique();
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await google(page, `${unique()}@example.com`, subject);
  await page.getByRole("link", { name: "Connect an existing account" }).click();
  await page.getByLabel("Handle", { exact: true }).fill(account.handle);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/google$/);
  await page
    .getByRole("button", { name: `Connect Google to @${account.handle}` })
    .click();
  await expect(page).toHaveURL(/settings\?connected=1/);
  expect(
    (await db.signInIdentity.findFirstOrThrow({ where: { subject } }))
      .accountId,
  ).toBe(account.id);
});

test("verification and email reset work once, preserve account data and invalidate both sessions and backup codes", async ({
  page,
  browser,
}) => {
  const account = await human(),
    email = `${unique()}@example.com`;
  await login(page, account.handle);
  const other = await browser.newPage();
  await login(other, account.handle);
  await createRecoveryCodes(account.id, password);
  await page.goto("/settings");
  await page.getByLabel("Recovery email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send verification email" }).click();
  await expect(
    page
      .locator(".success[role=status]")
      .filter({ hasText: "Check your inbox" }),
  ).toBeVisible();
  const verification = await mailLink(email, "/auth/verify-email");
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: account.id } }))
      .recoveryEmail,
  ).toBeNull();
  await page.goto(verification);
  // GET alone, including email scanner visits, cannot consume the token.
  expect(
    await db.accountAuthToken.count({
      where: { accountId: account.id, purpose: "verify-email" },
    }),
  ).toBe(1);
  await page.getByRole("button", { name: "Verify recovery email" }).click();
  await expect(page).toHaveURL(/settings\?verified=1/);
  const guest = await browser.newPage();
  await guest.goto("/forgot-password");
  await guest.getByLabel("Recovery email").fill(email);
  await guest
    .getByRole("button", { name: "Send recovery instructions" })
    .click();
  await expect(guest.getByRole("status")).toContainText("If this email");
  const reset = await mailLink(email, "/auth/reset-password");
  await guest.goto(reset);
  await guest
    .getByLabel("New password", { exact: true })
    .fill("AChangedPassword_123!");
  await guest.getByLabel("Confirm new password").fill("AChangedPassword_123!");
  await guest
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(guest).toHaveURL(/login\?recovered=1/);
  for (const old of [page, other])
    expect((await old.request.get("/api/public-room/messages")).status()).toBe(
      401,
    );
  expect(
    await db.recoveryCode.count({ where: { accountId: account.id } }),
  ).toBe(0);
  await guest.goto(reset);
  await expect(
    guest.getByText("This link expired or was already used.", { exact: false }),
  ).toBeVisible();
  await other.close();
  await guest.close();
});

test("security boundaries: stale proof, different actor, duplicate identity, last method and reset races", async () => {
  const a = await human(),
    b = await human(),
    agent = await human({ type: "AGENT" });
  const actor = { id: a.id, sessionVersion: 0, authenticatedAt: Date.now() };
  await expect(
    db.$transaction((tx) =>
      requireRecent(tx, { ...actor, authenticatedAt: 1 }, "wrong"),
    ),
  ).rejects.toThrow("current password");
  await expect(
    db.$transaction((tx) =>
      requireRecent(tx, { ...actor, sessionVersion: 99 }, password),
    ),
  ).rejects.toThrow("Sign in again");
  await expect(
    requestEmailVerification(
      { id: agent.id, sessionVersion: 0, authenticatedAt: Date.now() },
      `${unique()}@example.com`,
      "",
    ),
  ).rejects.toThrow("human account");
  const subject = unique(),
    email = `${unique()}@example.com`;
  const proof = await googleProfileProof(subject, email, "/dashboard");
  await linkGoogle(actor, "", proof);
  await expect(
    linkGoogle(
      { id: b.id, sessionVersion: 0, authenticatedAt: Date.now() },
      "",
      await googleProfileProof(subject, email, "/dashboard"),
    ),
  ).rejects.toThrow("already connected");
  const verifyEmail = `${unique()}@example.com`;
  await requestEmailVerification(actor, verifyEmail, "");
  const verifyToken = new URL(
    await mailLink(verifyEmail, "/auth/verify-email"),
  ).searchParams.get("token")!;
  await expect(verifyRecoveryEmail(verifyToken, b.id)).rejects.toThrow(
    "account that requested",
  );
  await verifyRecoveryEmail(verifyToken, a.id);
  await expect(verifyRecoveryEmail(verifyToken, a.id)).rejects.toThrow();
  // Matching recovery email cannot silently merge or create another Google account.
  await expect(
    createGoogleAccount(
      await googleProfileProof(unique(), verifyEmail, "/dashboard"),
      `dup_${unique()}`,
      "Duplicate",
    ),
  ).rejects.toThrow("already in use");
  const token = randomUUID().replaceAll("-", "").padEnd(43, "a");
  await db.accountAuthToken.create({
    data: {
      tokenHash: tokenDigest(token),
      purpose: "reset-password",
      accountId: a.id,
      sessionVersion: 0,
      email: verifyEmail,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const results = await Promise.allSettled([
    resetEmailPassword(token, password),
    resetEmailPassword(token, password),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: a.id } }))
      .sessionVersion,
  ).toBe(1);
});

for (const failure of ["unverified", "badNonce", "cancel"] as const)
  test(`Google rejects ${failure} without creating an account`, async ({
    page,
  }) => {
    const subject = unique();
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await google(page, `${unique()}@example.com`, subject, { [failure]: true });
    await expect(page).toHaveURL(/\/login\?/);
    expect(await db.signInIdentity.count({ where: { subject } })).toBe(0);
    await expect(page.locator(".error[role=alert]")).toBeVisible();
  });

test("rollout notice is account-scoped, snoozes once, stops after completion and never targets agents", async ({
  page,
}) => {
  const account = await human({ old: true });
  await login(page, account.handle);
  const notice = page.getByRole("complementary", {
    name: "More ways to sign in",
  });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Not now" }).click();
  await expect(notice).toHaveCount(0);
  await db.accountAuthNotice.update({
    where: { accountId: account.id },
    data: { remindAt: new Date(0) },
  });
  await page.reload();
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Not now" }).click();
  await db.accountAuthNotice.update({
    where: { accountId: account.id },
    data: { remindAt: new Date(0) },
  });
  await page.reload();
  await expect(notice).toHaveCount(0);
  const second = await human({
    old: true,
    recoveryEmail: `${unique()}@example.com`,
  });
  await logout(page);
  await login(page, second.handle);
  await expect(notice).toHaveCount(0);
  const agent = await human({ type: "AGENT", old: true });
  await logout(page);
  await login(page, agent.handle);
  await expect(notice).toHaveCount(0);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Sign-in and recovery" }),
  ).toHaveCount(0);
});

test("human signup collects email, agents retain password-only signup, auth pages fit mobile and dark mode", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(page.getByLabel("Recovery email")).toBeVisible();
  await page.locator('input[value="AGENT"]').check();
  await expect(page.getByLabel("Recovery email")).toHaveCount(0);
  await page.locator('input[value="OWNER"]').check();
  const handle = `signup_${unique()}`,
    email = `${unique()}@example.com`;
  await page.getByLabel("Display name", { exact: true }).fill("Email signup");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Recovery email").fill(email);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await mailLink(email, "/auth/verify-email");
  for (const width of [390, 1440])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(
        (value) => localStorage.setItem("minglo-theme", value),
        theme,
      );
      await page.goto("/settings");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.local/auth-release/settings-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  await logout(page);
  for (const route of [
    "/login",
    "/forgot-password",
    "/auth/reset-password?token=invalid",
  ]) {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("a cancelled linking attempt returns the signed-in user to Settings with an explanation", async ({
  page,
}) => {
  const account = await human();
  await login(page, account.handle);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Sign in with Google", exact: true })
    .click();
  await google(page, `${unique()}@example.com`, unique(), { cancel: true });
  await expect(page).toHaveURL(/settings\?authError=link/);
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Google could not be connected",
  );
  expect(
    await db.signInIdentity.count({ where: { accountId: account.id } }),
  ).toBe(0);
});

test("email changes preserve the current address until confirmation and invalidate previous reset links", async () => {
  const oldEmail = `${unique()}@example.com`,
    newEmail = `${unique()}@example.com`;
  const account = await human({ recoveryEmail: oldEmail });
  const oldToken = randomUUID().replaceAll("-", "").padEnd(43, "b");
  await db.accountAuthToken.create({
    data: {
      tokenHash: tokenDigest(oldToken),
      purpose: "reset-password",
      accountId: account.id,
      sessionVersion: 0,
      email: oldEmail,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await requestEmailVerification(
    { id: account.id, sessionVersion: 0, authenticatedAt: Date.now() },
    newEmail,
    "",
  );
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: account.id } }))
      .recoveryEmail,
  ).toBe(oldEmail);
  const link = await mailLink(newEmail, "/auth/verify-email");
  await verifyRecoveryEmail(
    new URL(link).searchParams.get("token")!,
    account.id,
  );
  expect(
    (await db.account.findUniqueOrThrow({ where: { id: account.id } }))
      .recoveryEmail,
  ).toBe(newEmail);
  await expect(resetEmailPassword(oldToken, password)).rejects.toThrow(
    "expired",
  );
});

test("email delivery failure removes the undelivered verification credential and preserves account state", async () => {
  const account = await human();
  const originalFetch = globalThis.fetch,
    transport = process.env.MINGLO_EMAIL_TRANSPORT,
    key = process.env.RESEND_API_KEY;
  const idempotency = new Set<string>();
  let requests = 0;
  process.env.MINGLO_EMAIL_TRANSPORT = "resend";
  process.env.RESEND_API_KEY = "local-test-only";
  globalThis.fetch = async (_input, init) => {
    requests++;
    idempotency.add(new Headers(init?.headers).get("Idempotency-Key")!);
    return new Response("Unavailable", { status: 503 });
  };
  try {
    await expect(
      requestEmailVerification(
        { id: account.id, sessionVersion: 0, authenticatedAt: Date.now() },
        `${unique()}@example.com`,
        "",
      ),
    ).rejects.toThrow("delivery is unavailable");
    expect(requests).toBe(2);
    expect(idempotency.size).toBe(1);
    expect(
      await db.accountAuthToken.count({
        where: { accountId: account.id, purpose: "verify-email" },
      }),
    ).toBe(0);
    expect(
      (await db.account.findUniqueOrThrow({ where: { id: account.id } }))
        .recoveryEmail,
    ).toBeNull();
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MINGLO_EMAIL_TRANSPORT = transport;
    if (key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = key;
  }
});

test("a settings page left open exposes reauthentication controls when its recent sign-in expires", async ({
  page,
}) => {
  const account = await human();
  await login(page, account.handle);
  await page.goto("/settings");
  await expect(page.locator("#email-password")).toHaveCount(0);
  const { decode, encode } = await import("next-auth/jwt");
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "authjs.session-token",
  )!;
  const token = await decode({
    token: cookie.value,
    secret: process.env.AUTH_SECRET!,
    salt: cookie.name,
  });
  const value = await encode({
    token: { ...token!, authenticatedAt: Date.now() - 11 * 60_000 },
    secret: process.env.AUTH_SECRET!,
    salt: cookie.name,
  });
  await page.context().addCookies([{ ...cookie, value }]);
  await page
    .getByLabel("Recovery email", { exact: true })
    .fill(`${unique()}@example.com`);
  await page.getByRole("button", { name: "Send verification email" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "current password",
  );
  await expect(page.locator("#email-password")).toBeVisible();
  await page.locator("#email-password").fill(password);
  await page.getByRole("button", { name: "Send verification email" }).click();
  await expect(page.locator(".success[role=status]")).toContainText(
    "Check your inbox",
  );
});
