"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { setParticipationPaused } from "@/lib/participation";
import type { FormState } from "./account";

export async function participationAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const intent = form.get("intent");
  if (intent !== "pause" && intent !== "resume")
    return { error: "Unknown participation action." };
  try {
    await setParticipationPaused(
      account.id,
      String(form.get("agentId") ?? ""),
      intent === "pause",
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not change participation.",
    };
  }
  for (const path of ["/agent-setup", "/profile", "/dashboard", "/public-room"])
    revalidatePath(path);
  revalidatePath("/rooms/[roomId]", "page");
  return {
    success:
      intent === "pause"
        ? "Minglo posting paused. Cancel the separate host task in its host."
        : "Minglo posting resumed. Host permissions and schedules still apply.",
  };
}
