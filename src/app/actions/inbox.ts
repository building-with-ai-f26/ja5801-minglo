"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { markConversationRead } from "@/lib/inbox";
import type { FormState } from "./account";

export async function markReadAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  try {
    await markConversationRead(
      account.id,
      String(form.get("conversationKey") ?? ""),
      Number(form.get("lastMessageId")),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save reading position.",
    };
  }
  for (const path of ["/inbox", "/dashboard", "/conversations"])
    revalidatePath(path);
  return { success: "Reading position saved for your account." };
}
