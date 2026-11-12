"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/session";
import {
  DirectMessageError,
  requestDirectConversation,
  respondToDirectRequest,
  postDirectMessage,
} from "@/lib/direct-messages";
import { archiveDirectConversation } from "@/lib/conversation-preferences";
import type { FormState } from "./account";
import type { MessageState } from "./messages";

export type DirectConsentState = { error?: string; reviewRequired?: boolean };
function refreshDirect(id?: string) {
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/profiles/[handle]", "page");
  if (id) revalidatePath(`/messages/${id}`);
}
export async function directConsentAction(
  targetId: string,
  conversationId: string | null,
  _state: DirectConsentState,
  form: FormData,
): Promise<DirectConsentState> {
  const account = await requireAccount();
  let id: string;
  try {
    const consent = {
      visibilityConfirmed: form.get("visibilityConfirmed") === "yes",
      visibilityToken: form.get("visibilityToken"),
    };
    const conversation = conversationId
      ? await respondToDirectRequest(account.id, conversationId, {
          ...consent,
          decision: "accept",
          requestVersion: Number(form.get("requestVersion")),
        })
      : await requestDirectConversation(account.id, targetId, {
          ...consent,
          body: form.get("body"),
          clientMessageId: form.get("clientMessageId"),
        });
    id = conversation.id;
  } catch (error) {
    if (error instanceof DirectMessageError)
      return { error: error.message, reviewRequired: error.status === 409 };
    throw error;
  }
  refreshDirect(id);
  redirect(`/messages/${id}`);
}
export async function directDecisionAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const id = String(form.get("conversationId") ?? "");
  const decision = form.get("decision");
  if (decision !== "decline" && decision !== "cancel")
    return { error: "Choose decline or cancel." };
  try {
    await respondToDirectRequest(account.id, id, {
      decision,
      requestVersion: Number(form.get("requestVersion")),
    });
  } catch (error) {
    if (error instanceof DirectMessageError) return { error: error.message };
    throw error;
  }
  refreshDirect(id);
  return {
    success:
      decision === "decline"
        ? "Chat request declined."
        : "Chat request cancelled.",
  };
}
export async function postDirectMessageAction(
  id: string,
  _state: MessageState,
  form: FormData,
): Promise<MessageState> {
  const account = await requireAccount();
  try {
    const m = await postDirectMessage(account.id, id, {
      body: form.get("body"),
      clientMessageId: form.get("clientMessageId"),
      replyToId: form.get("replyToId"),
    });
    refreshDirect(id);
    return { sentId: m.id };
  } catch (error) {
    if (error instanceof DirectMessageError) return { error: error.message };
    throw error;
  }
}
export async function directArchiveAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const id = String(form.get("conversationId") ?? "");
  try {
    await archiveDirectConversation(
      account.id,
      id,
      form.get("archived") === "yes",
    );
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  refreshDirect(id);
  return { success: "Chat organization saved for your account." };
}
