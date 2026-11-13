import { db } from "./db";

export const TOUR_VERSION = 1;
export type TourPreferenceView = {
  autoOfferEnabled: boolean;
  status: "EXISTING" | "UNSEEN" | "OFFERED" | "SKIPPED" | "COMPLETED";
};

export function tourPreferenceView(
  preference: {
    autoOfferEnabled: boolean;
    status: TourPreferenceView["status"];
  } | null,
): TourPreferenceView {
  return preference ?? { autoOfferEnabled: false, status: "EXISTING" };
}

// Exact workspace destinations only; a claim, transcript or editor never consumes
// the first-use offer. This is eligibility, not a navigation/authorization grant.
export function tourOfferEligible(
  path: string,
  role: "OWNER" | "AGENT",
  topics: boolean,
) {
  return [
    "/dashboard",
    "/discover",
    "/profile",
    ...(role === "OWNER" ? ["/agents"] : []),
    ...(topics ? ["/topics"] : []),
  ].includes(path);
}

export async function claimTourOffer(accountId: string) {
  const result = await db.accountTourPreference.updateMany({
    where: { accountId, status: "UNSEEN", autoOfferEnabled: true },
    data: { status: "OFFERED", seenVersion: TOUR_VERSION },
  });
  return result.count === 1;
}

export async function updateTourPreference(
  accountId: string,
  operation: "start" | "skip" | "complete" | "enable" | "disable",
) {
  // Upsert serializes initial creation. Missing rows represent existing accounts,
  // so neither replay nor enabling the preference makes them automatically new.
  return db.$transaction(async (tx) => {
    await tx.accountTourPreference.upsert({
      where: { accountId },
      create: { accountId, status: "OFFERED", seenVersion: TOUR_VERSION },
      update: {},
    });
    if (operation === "enable" || operation === "disable") {
      await tx.accountTourPreference.update({
        where: { accountId },
        data: { autoOfferEnabled: operation === "enable" },
      });
    } else {
      await tx.accountTourPreference.updateMany({
        where: { accountId, status: { not: "COMPLETED" } },
        data: {
          status:
            operation === "complete"
              ? "COMPLETED"
              : operation === "skip"
                ? "SKIPPED"
                : "OFFERED",
          seenVersion: TOUR_VERSION,
          ...(operation === "complete" ? { completedAt: new Date() } : {}),
        },
      });
    }
    return tx.accountTourPreference.findUniqueOrThrow({
      where: { accountId },
      select: { autoOfferEnabled: true, status: true },
    });
  });
}
