import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { topicsEnabled } from "../../src/lib/topic-launch";
import { getDiscussionReturns } from "../../src/lib/return-activity";
import { consumeClaim, issueClaim } from "../../src/lib/claims";
import {
  structureAccount as account,
  structureChat as chat,
} from "./app-structure-fixtures";
import {
  checkStructureNavigation,
  expectUnavailablePage,
} from "./app-structure-navigation";
import { login } from "./helpers";

test.afterAll(() => db.$disconnect());

for (const role of ["OWNER", "AGENT"] as const) {
  test(`${role}: served Topics-off pages suppress every entry point while personal journeys work`, async ({
    page,
  }, info) => {
    test.setTimeout(180_000);
    expect(topicsEnabled()).toBe(false);
    const viewer = await account(
        role,
        "A very long display name that must wrap on a narrow phone",
      ),
      author = await account("AGENT"),
      peer = await account();
    if (role === "OWNER")
      await consumeClaim(viewer.id, (await issueClaim(author.id)).token);
    const direct = await chat(
      peer.id,
      viewer.id,
      "Personal chat still available",
      "ACTIVE",
    );
    const topic = await db.topic.create({
      data: {
        slug: `off-${randomUUID()}`,
        name: "Off-only topic fixture",
        description: "Must not appear while disabled",
        rules: "Respect privacy",
      },
    });
    const thread = await db.discussionThread.create({
      data: {
        topicId: topic.id,
        creatorAccountId: author.id,
        title: "Off-only discussion fixture",
        clientCreationId: randomUUID(),
        messages: {
          create: {
            senderAccountId: author.id,
            body: "Off-only topic contribution",
            clientMessageId: randomUUID(),
          },
        },
      },
    });
    await db.topicFollow.create({
      data: { accountId: viewer.id, topicId: topic.id },
    });
    await db.conversationPreference.create({
      data: {
        accountId: viewer.id,
        conversationKey: `discussion:${thread.id}`,
        subscribed: true,
      },
    });
    expect(await getDiscussionReturns(viewer.id)).toEqual([]);
    await login(page, viewer.handle);
    for (const route of [
      "/dashboard",
      "/discover",
      "/public-room",
      "/profile",
      `/profiles/${author.handle}`,
      "/inbox",
      "/guide",
      "/agent-setup",
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('a[href^="/topics"]')).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(
        "Off-only topic contribution",
      );
      await expect(page.locator("main")).not.toContainText(
        "Off-only discussion fixture",
      );
    }
    await page.goto("/discover?view=topics&followed=1&after=invalid");
    await expect(
      page.getByRole("heading", { name: "People & agents", exact: true }),
    ).toBeVisible();
    await expect(page.locator('a[href^="/topics"]')).toHaveCount(0);
    for (const route of [
      "/topics",
      "/topics/new",
      `/topics/${topic.slug}`,
      `/topics/${topic.slug}/new`,
      `/topics/${topic.slug}/discussions/${thread.id}`,
    ]) {
      await expectUnavailablePage(page, route);
      await expect(page.locator('input[name="clientCreationId"]')).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("heading", {
          name: "Find a discussion worth joining.",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(
        "Off-only topic contribution",
      );
    }
    expect(
      (
        await page.request.get(
          `/api/topics/${topic.slug}/discussions/${thread.id}/messages`,
        )
      ).status(),
    ).toBe(404);
    await page.goto(`/messages/${direct.id}`);
    await expect(page.getByRole("log")).toContainText(
      "Personal chat still available",
    );
    await page.goto("/agents");
    if (role === "AGENT") await expect(page).toHaveURL("/profile");
    else
      await expect(
        page.getByRole("region", {
          name: `Connected agent @${author.handle}`,
          exact: true,
        }),
      ).toBeVisible();
    await checkStructureNavigation(page, role, false, info);
  });
}
