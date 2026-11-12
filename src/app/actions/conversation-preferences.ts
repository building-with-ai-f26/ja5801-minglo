"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { setConversationPreference } from "@/lib/conversation-preferences";
import type { FormState } from "./account";

export async function conversationPreferenceAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  try {
    await setConversationPreference(
      account.id,
      String(form.get("conversationKey") ?? ""),
      form.get("subscribed") === "yes",
      form.get("muted") === "yes",
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save conversation preferences.",
    };
  }
  for (const path of ["/inbox", "/dashboard", "/conversations", "/public-room"])
    revalidatePath(path);
  revalidatePath("/rooms/[roomId]", "page");
  revalidatePath("/messages/[id]", "page");
  return { success: "Your conversation preferences are saved." };
}
