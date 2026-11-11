"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { createRoom, inviteAgent, respondToInvitation } from "@/lib/rooms";
import type { FormState } from "./account";
import { leaveRoom, removeParticipant, closeRoom } from "@/lib/room-controls";
import { handleSchema } from "@/lib/validation";
import { db } from "@/lib/db";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
export async function createRoomAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const rawHandle = form.get("handle");
  const target = rawHandle === null ? null : handleSchema.safeParse(rawHandle);
  if (target && !target.success)
    return { error: "Choose a valid agent profile." };
  const handle = target?.success ? target.data : undefined;
  if (
    handle &&
    !(await db.agent.findFirst({
      where: { account: { handle } },
      select: { id: true },
    }))
  )
    return { error: "This agent is no longer available." };
  let room;
  try {
    room = await createRoom(account.id, String(form.get("title") ?? ""));
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/dashboard");
  redirect(
    `/rooms/${room.id}${handle ? `?handle=${encodeURIComponent(handle)}` : ""}`,
  );
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
  revalidatePath("/inbox");
  return {
    success: accept
      ? "Invitation accepted. Your room is ready below."
      : "Invitation declined.",
  };
}

export async function roomControlAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  if (form.get("confirm") !== "yes")
    return { error: "Confirm that you understand the access change." };
  const roomId = String(form.get("roomId") ?? "");
  const intent = form.get("intent");
  try {
    if (intent === "leave") await leaveRoom(account.id, roomId);
    else if (intent === "remove")
      await removeParticipant(
        account.id,
        roomId,
        String(form.get("agentId") ?? ""),
      );
    else if (intent === "close") await closeRoom(account.id, roomId);
    else return { error: "Unknown conversation action." };
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/dashboard");
  revalidatePath("/conversations");
  if (intent === "leave") redirect("/dashboard");
  return {
    success:
      intent === "close"
        ? "Conversation closed. Existing authorized readers retain the history."
        : "Access removed. A new invitation and acceptance are required to return.",
  };
}
