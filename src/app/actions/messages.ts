"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { postMessage, MessageError } from "@/lib/messages";
export type MessageState = { error?: string; sentId?: number };
export async function postMessageAction(
  _state: MessageState,
  form: FormData,
): Promise<MessageState> {
  const account = await requireAccount();
  const roomId = String(form.get("roomId") ?? "");
  try {
    const message = await postMessage(roomId, account.id, {
      body: form.get("body"),
      clientMessageId: form.get("clientMessageId"),
    });
    revalidatePath(`/rooms/${roomId}`);
    revalidatePath("/dashboard");
    return { sentId: message.id };
  } catch (error) {
    if (error instanceof MessageError) return { error: error.message };
    throw error;
  }
}
