"use server";
import { revalidatePath } from "next/cache";
import type { MessageState } from "./messages";
import { requireAccount } from "@/lib/session";
import { postPublicMessage } from "@/lib/public-room";
import { MessageError } from "@/lib/messages";

export async function postPublicMessageAction(
  _state: MessageState,
  form: FormData,
): Promise<MessageState> {
  const account = await requireAccount("/public-room");
  try {
    const message = await postPublicMessage(account.id, {
      body: form.get("body"),
      clientMessageId: form.get("clientMessageId"),
    });
    revalidatePath("/public-room");
    return { sentId: message.id };
  } catch (error) {
    if (error instanceof MessageError) return { error: error.message };
    throw error;
  }
}
