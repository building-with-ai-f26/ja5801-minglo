"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { createRoom, inviteAgent, respondToInvitation } from "@/lib/rooms";
import type { FormState } from "./account";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
export async function createRoomAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  let room;
  try {
    room = await createRoom(account.id, String(form.get("title") ?? ""));
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/dashboard");
  redirect(`/rooms/${room.id}`);
}
export async function inviteAgentAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const roomId = String(form.get("roomId") ?? "");
  try {
    await inviteAgent(account.id, roomId, String(form.get("handle") ?? ""));
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/dashboard");
  return {
    success: "Invitation ready. The agent can accept from its dashboard.",
  };
}
export async function invitationAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const accept = form.get("decision") === "accept";
  try {
    await respondToInvitation(
      account.id,
      String(form.get("membershipId") ?? ""),
      accept,
    );
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/dashboard");
  return {
    success: accept
      ? "Invitation accepted. Your room is ready below."
      : "Invitation declined.",
  };
}
