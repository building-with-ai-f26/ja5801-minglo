import { test, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { hash } from "argon2";
import { fetchGithubProfile } from "../../src/lib/github-profile";
import { db } from "../../src/lib/db";
import { login, password } from "./helpers";

test.afterAll(() => db.$disconnect());

test("GitHub import uses a fixed public endpoint and projects only bounded public fields", async () => {
  let calls = 0;
  const request = (async (url: string, options: RequestInit) => {
    calls++;
    expect(url).toBe("https://api.github.com/users/test-user");
    expect(options.redirect).toBe("error");
    expect(options.cache).toBe("no-store");
    expect(JSON.stringify(options.headers)).not.toMatch(
      /authorization|bearer/i,
    );
    return Response.json({
      login: "test-user",
      name: "N".repeat(100),
      bio: "B".repeat(800),
      email: "PRIVATE",
      location: "PRIVATE",
      avatar_url: "PRIVATE",
    });
  }) as typeof fetch;
  const result = await fetchGithubProfile(" test-user ", request);
  expect(result).toEqual({
    profile: {
      username: "test-user",
      displayName: "N".repeat(60),
      bio: "B".repeat(500),
    },
  });
  for (const invalid of [
    "",
    "https://github.com/user",
    "../claim",
    "@user",
    "a--b",
    "a-",
    "x".repeat(40),
    null,
  ]) {
    expect((await fetchGithubProfile(invalid, request)).error).toBeTruthy();
  }
  expect(calls).toBe(1);
});

test("GitHub failures never expose response bodies and null bios preserve the current draft", async () => {
  for (const status of [404, 403, 429, 500]) {
    const result = await fetchGithubProfile(
      "example",
      (async () => new Response("PRIVATE", { status })) as typeof fetch,
    );
    expect(result.error).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  }
  expect(
    (
      await fetchGithubProfile("example", (async () => {
        throw new Error("PRIVATE");
      }) as typeof fetch)
    ).error,
  ).toBeTruthy();
  expect(
    (
      await fetchGithubProfile("example", (async () =>
        Response.json({
          login: "example",
          name: null,
          bio: null,
        })) as typeof fetch)
    ).profile,
  ).toEqual({ username: "example", displayName: "example", bio: "" });
  expect(
    (
      await fetchGithubProfile("example", (async () =>
        Response.json({ private: "PRIVATE" })) as typeof fetch)
    ).error,
  ).toBeTruthy();
});

for (const type of ["OWNER", "AGENT"] as const) {
  test(`${type}: optional lookup validates, throttles by session and leaves editable drafts intact`, async ({
    page,
  }) => {
    const handle = `github_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const account = await db.account.create({
      data: {
        handle,
        type,
        passwordHash: await hash(password),
        ...(type === "OWNER"
          ? { owner: { create: { displayName: "Original" } } }
          : { agent: { create: { displayName: "Original" } } }),
      },
    });
    await login(page, handle);
    await page.goto("/profile?edit=1");
    await page.getByLabel("Display name", { exact: true }).fill("Edited draft");
    await page
      .getByLabel("About you", { exact: true })
      .fill("Keep this introduction");
    await page.getByText("Import from GitHub", { exact: true }).click();
    await page
      .getByLabel("Public GitHub username")
      .fill("https://github.com/example");
    await page.getByLabel("Public GitHub username").press("Enter");
    await expect(page.getByRole("alert")).toContainText("without a URL");
    expect(
      await db.rateLimit.count({
        where: {
          key: createHash("sha256")
            .update(`github-profile:${account.id}`)
            .digest("hex"),
        },
      }),
    ).toBe(0);
    await db.rateLimit.create({
      data: {
        key: createHash("sha256")
          .update(`github-profile:${account.id}`)
          .digest("hex"),
        count: 10,
        resetAt: new Date(Date.now() + 900000),
      },
    });
    await page.getByLabel("Public GitHub username").fill("example");
    await page.getByRole("button", { name: "Preview GitHub profile" }).click();
    await expect(page.getByRole("alert")).toContainText("15 minutes");
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
      "Edited draft",
    );
    await expect(page.getByLabel("About you", { exact: true })).toHaveValue(
      "Keep this introduction",
    );
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Optional import validation must not block normal profile saving.
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      page
        .locator("form")
        .filter({
          has: page.getByRole("button", { name: "Save profile", exact: true }),
        })
        .getByRole("status")
        .last(),
    ).toContainText("saved");
    const saved =
      type === "OWNER"
        ? await db.owner.findUniqueOrThrow({ where: { accountId: account.id } })
        : await db.agent.findUniqueOrThrow({
            where: { accountId: account.id },
          });
    expect(saved).toMatchObject({
      displayName: "Edited draft",
      bio: "Keep this introduction",
    });
  });
}
