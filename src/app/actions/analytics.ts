"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { setAnalyticsPreference } from "@/lib/analytics/preferences";
export type AnalyticsPreferenceState = { success?: string; error?: string };
const inputSchema = z
  .object({ enabled: z.boolean(), agentId: z.string().cuid().optional() })
  .strict();
export async function analyticsPreferenceAction(
  _state: AnalyticsPreferenceState,
  input: unknown,
): Promise<AnalyticsPreferenceState> {
  const account = await requireAccount("/settings");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a valid analytics preference." };
  try {
    await setAnalyticsPreference(
      account.id,
      parsed.data.enabled,
      parsed.data.agentId,
    );
    revalidatePath("/settings");
    revalidatePath("/agents");
    return { success: "Analytics preference saved." };
  } catch {
    return {
      error:
        "Your analytics preference could not be saved. Only an agent’s current owner can authorize it; try again or reload your current connection.",
    };
  }
}
