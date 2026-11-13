import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import {
  claimTourOffer,
  updateTourPreference,
  tourOfferEligible,
  tourPreferenceView,
} from "../../src/lib/tour-preferences";
import { structureAccount as account } from "./app-structure-fixtures";

test.afterAll(() => db.$disconnect());

test("existing accounts stay manual-only; new preferences claim one offer across tabs", async () => {
  const existing = await account(),
    fresh = await account("AGENT");
  expect(tourPreferenceView(null)).toEqual({
    status: "EXISTING",
    autoOfferEnabled: false,
  });
  expect(await claimTourOffer(existing.id)).toBe(false);
  await db.accountTourPreference.create({ data: { accountId: fresh.id } });
  const claims = await Promise.all(
    Array.from({ length: 8 }, () => claimTourOffer(fresh.id)),
  );
  expect(claims.filter(Boolean)).toHaveLength(1);
  expect(await claimTourOffer(fresh.id)).toBe(false);
  expect(
    await db.accountTourPreference.count({ where: { accountId: existing.id } }),
  ).toBe(0);
});

test("completion survives replay, skip and late offer callbacks; state is account-scoped", async () => {
  const a = await account(),
    b = await account("AGENT");
  await updateTourPreference(a.id, "start");
  await updateTourPreference(a.id, "complete");
  const completed = await db.accountTourPreference.findUniqueOrThrow({
    where: { accountId: a.id },
  });
  await Promise.all([
    updateTourPreference(a.id, "skip"),
    updateTourPreference(a.id, "start"),
    claimTourOffer(a.id),
  ]);
  await updateTourPreference(a.id, "complete");
  expect(
    await db.accountTourPreference.findUniqueOrThrow({
      where: { accountId: a.id },
    }),
  ).toMatchObject({ status: "COMPLETED", completedAt: completed.completedAt });
  expect(
    await db.accountTourPreference.findUnique({ where: { accountId: b.id } }),
  ).toBeNull();
});

test("automatic preference never resets seen history or enrolls existing accounts", async () => {
  const a = await account(),
    fresh = await account();
  await updateTourPreference(a.id, "enable");
  expect(await claimTourOffer(a.id)).toBe(false);
  await db.accountTourPreference.create({ data: { accountId: fresh.id } });
  await updateTourPreference(fresh.id, "disable");
  expect(await claimTourOffer(fresh.id)).toBe(false);
  await updateTourPreference(fresh.id, "enable");
  expect(await claimTourOffer(fresh.id)).toBe(true);
  await updateTourPreference(fresh.id, "skip");
  await updateTourPreference(fresh.id, "disable");
  await updateTourPreference(fresh.id, "enable");
  expect(await claimTourOffer(fresh.id)).toBe(false);
});

test("automatic offers exclude deep links, editors and disabled destinations", () => {
  for (const route of [
    "/claim/secret",
    "/public-room",
    "/inbox",
    "/messages/secret",
    "/profile?edit=1",
    "/topics/new",
    "/topics/example",
    "/settings",
    "/agent-setup",
    "/login",
    "https://evil.test/dashboard",
  ]) {
    expect(tourOfferEligible(route, "OWNER", true)).toBe(false);
  }
  expect(tourOfferEligible("/topics", "AGENT", false)).toBe(false);
  expect(tourOfferEligible("/topics", "AGENT", true)).toBe(true);
  expect(tourOfferEligible("/agents", "AGENT", true)).toBe(false);
  expect(tourOfferEligible("/agents", "OWNER", true)).toBe(true);
});
