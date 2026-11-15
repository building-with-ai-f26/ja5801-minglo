import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { analyticsConfig } from "../../src/lib/analytics/config";
import {
  eventProperties,
  safeBrowserEvent,
  analyticsPage,
} from "../../src/lib/analytics/events";
import {
  analyticsIdentity,
  setAnalyticsPreference,
} from "../../src/lib/analytics/preferences";
test.afterAll(async () => {
  await db.$disconnect();
});
test("analytics defaults closed and strips SDK URL/person properties", () => {
  expect(analyticsConfig()).toBeNull();
  const identity = {
    analyticsId: randomUUID(),
    accountType: "person" as const,
  };
  const clean = safeBrowserEvent(
    {
      event: "page_viewed",
      properties: {
        page_name: "profile",
        $current_url: "/claim/SECRET",
        $set: { email: "SECRET" },
        bio: "SECRET",
      },
    },
    identity,
  );
  expect(JSON.stringify(clean)).not.toContain("SECRET");
  expect(clean?.properties.token).toBe("minglo-local-mock");
  expect(clean?.properties.$geoip_disable).toBe(true);
  const topLevel = safeBrowserEvent(
    {
      event: "page_viewed",
      $set_once: { private_url: "SECRET_CLAIM" },
      $set: { name: "SECRET_NAME" },
      properties: { page_name: "home" },
    },
    identity,
    "public-mock-token",
  );
  expect(JSON.stringify(topLevel)).not.toMatch(/SECRET_|\$set_once/);
  expect(topLevel?.properties.token).toBe("public-mock-token");
  expect(
    eventProperties("message_posted", {
      conversation_kind: "public",
      is_reply_to_other: false,
      body: "SECRET",
    }),
  ).toBeNull();
  for (const path of [
    "/claim/SECRET",
    "/recover?token=SECRET",
    "/settings",
    "/login",
  ])
    expect(analyticsPage(path)).toBeNull();
  expect(analyticsPage("/profiles/someone")).toBe("profile");
});
test("mock capture cannot use remote hosts or run on a Heroku dyno", () => {
  const names = [
    "POSTHOG_ENABLED",
    "POSTHOG_TRANSPORT",
    "POSTHOG_MOCK_HOST",
    "DYNO",
  ] as const;
  const saved = names.map((name) => process.env[name]);
  try {
    process.env.POSTHOG_ENABLED = "true";
    process.env.POSTHOG_TRANSPORT = "mock";
    delete process.env.DYNO;
    for (const host of [
      "https://us.i.posthog.com",
      "http://example.com",
      "http://localhost:3150/private",
      "http://user:secret@localhost:3150",
    ]) {
      process.env.POSTHOG_MOCK_HOST = host;
      expect(analyticsConfig()).toBeNull();
    }
    process.env.POSTHOG_MOCK_HOST = "http://127.0.0.1:3150";
    expect(analyticsConfig()).not.toBeNull();
    process.env.DYNO = "web.1";
    expect(analyticsConfig()).toBeNull();
  } finally {
    names.forEach((name, index) => {
      if (saved[index] === undefined) delete process.env[name];
      else process.env[name] = saved[index];
    });
  }
});
test("missing preferences stay off; only current owners authorize agents", async () => {
  const suffix = randomUUID().slice(0, 8);
  const owner = await db.account.create({
    data: {
      handle: `an_o_${suffix}`,
      type: "OWNER",
      passwordHash: "unused",
      owner: { create: { displayName: "Owner" } },
    },
    include: { owner: true },
  });
  const other = await db.account.create({
    data: {
      handle: `an_x_${suffix}`,
      type: "OWNER",
      passwordHash: "unused",
      owner: { create: { displayName: "Other" } },
    },
  });
  const agent = await db.account.create({
    data: {
      handle: `an_a_${suffix}`,
      type: "AGENT",
      passwordHash: "unused",
      agent: { create: { displayName: "Agent", ownerId: owner.owner!.id } },
    },
    include: { agent: true },
  });
  expect(await analyticsIdentity(owner.id)).toBeNull();
  await setAnalyticsPreference(owner.id, true, agent.agent!.id);
  expect(await analyticsIdentity(owner.id)).toBeNull();
  expect(await analyticsIdentity(agent.id)).toMatchObject({
    accountType: "agent",
  });
  await expect(
    setAnalyticsPreference(other.id, true, agent.agent!.id),
  ).rejects.toThrow();
  await expect(setAnalyticsPreference(agent.id, true)).rejects.toThrow();
  await setAnalyticsPreference(agent.id, false);
  expect(await analyticsIdentity(agent.id)).toBeNull();
  await setAnalyticsPreference(owner.id, true, agent.agent!.id);
  await db.agent.update({
    where: { id: agent.agent!.id },
    data: { ownerId: null },
  });
  expect(await analyticsIdentity(agent.id)).toBeNull();
  await setAnalyticsPreference(owner.id, true);
  expect(await analyticsIdentity(owner.id)).toMatchObject({
    accountType: "person",
  });
});
