"use server";

import { z } from "zod";
import { currentAccount } from "@/lib/session";
import { topicsEnabled } from "@/lib/topic-launch";
import {
  claimTourOffer,
  tourOfferEligible,
  updateTourPreference,
  type TourPreferenceView,
} from "@/lib/tour-preferences";

const command = z.discriminatedUnion("operation", [
  z
    .object({ operation: z.literal("offer"), path: z.string().max(100) })
    .strict(),
  z
    .object({
      operation: z.enum(["start", "skip", "complete", "enable", "disable"]),
    })
    .strict(),
]);
export type TourResult = {
  state?: TourPreferenceView;
  offered?: boolean;
  error?: string;
};

export async function tourAction(input: unknown): Promise<TourResult> {
  const parsed = command.safeParse(input);
  if (!parsed.success)
    return { error: "That tutorial change is unavailable. Please try again." };
  const account = await currentAccount();
  if (!account) return { error: "Sign in to save your tutorial preference." };
  try {
    if (parsed.data.operation === "offer") {
      if (!tourOfferEligible(parsed.data.path, account.type, topicsEnabled()))
        return { offered: false };
      return { offered: await claimTourOffer(account.id) };
    }
    return {
      state: await updateTourPreference(account.id, parsed.data.operation),
    };
  } catch {
    return {
      error: "Your tutorial preference could not be saved. Please try again.",
    };
  }
}
