import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { profileForViewer, setFollowing } from "../../src/lib/discovery";
import { login, password } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

for (const type of ["OWNER", "AGENT"] as const) {
  test(`${type}: profile counts show both directions and update after follow/unfollow`, async ({
    page,
    browser,
  }) => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
    const passwordHash = await hash(password);
    const accounts = [];
    for (const [label, role] of [
      ["target", type],
      ["viewer", type === "OWNER" ? "AGENT" : "OWNER"],
      ["peer", type],
    ] as const) {
      accounts.push(
        await db.account.create({
          data: {
            handle: `counts_${label}_${suffix}`,
            type: role,
            passwordHash,
            ...(role === "OWNER"
              ? { owner: { create: { displayName: label } } }
              : { agent: { create: { displayName: label } } }),
          },
        }),
      );
    }
    const [target, viewer, peer] = accounts;
    await login(page, viewer.handle);
    await page.goto(`/profiles/${target.handle}`);
    const counts = page.getByRole("group", {
      name: "Follow counts",
      exact: true,
    });
    await expect(
      counts.getByText("0 followers", { exact: true }),
    ).toBeVisible();
    await expect(
      counts.getByText("0 following", { exact: true }),
    ).toBeVisible();
    const follow = page
      .getByRole("region", { name: "Public profile", exact: true })
      .getByRole("button", { name: "Follow", exact: true });
    await follow.click();
    await expect(counts.getByText("1 follower", { exact: true })).toBeVisible();
    await expect(
      counts.getByText("0 following", { exact: true }),
    ).toBeVisible();
    // A repeated request must not increase the count; the two directions differ.
    await setFollowing(viewer.id, target.id, true);
    await setFollowing(peer.id, target.id, true);
    await setFollowing(target.id, peer.id, true);
    await page.reload();
    await expect(
      counts.getByText("2 followers", { exact: true }),
    ).toBeVisible();
    await expect(
      counts.getByText("1 following", { exact: true }),
    ).toBeVisible();
    expect(await profileForViewer(viewer.id, target.handle)).toMatchObject({
      followerCount: 2,
      followingCount: 1,
      isFollowing: true,
    });
    expect(await profileForViewer(peer.id, viewer.handle)).toMatchObject({
      followerCount: 0,
      followingCount: 1,
      isFollowing: false,
    });
    await page
      .getByRole("region", { name: "Public profile", exact: true })
      .getByRole("button", { name: "Unfollow", exact: true })
      .click();
    await expect(counts.getByText("1 follower", { exact: true })).toBeVisible();
    await expect(
      counts.getByText("1 following", { exact: true }),
    ).toBeVisible();

    const context = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    });
    try {
      const ownPage = await context.newPage();
      await login(ownPage, target.handle);
      await ownPage.goto(`/profiles/${target.handle}`);
      const ownCounts = ownPage.getByRole("group", {
        name: "Follow counts",
        exact: true,
      });
      await expect(
        ownCounts.getByText("1 follower", { exact: true }),
      ).toBeVisible();
      await expect(
        ownCounts.getByText("1 following", { exact: true }),
      ).toBeVisible();
      await expect(
        ownPage.getByRole("link", { name: "Edit profile", exact: true }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
}
