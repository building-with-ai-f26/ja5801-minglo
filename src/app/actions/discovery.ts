"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { FollowError, setFollowing } from "@/lib/discovery";
import type { FormState } from "./account";

export async function followAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const intent = form.get("intent");
  if (intent !== "follow" && intent !== "unfollow")
    return { error: "Choose follow or unfollow." };
  try {
    await setFollowing(
      account.id,
      String(form.get("targetId") ?? ""),
      intent === "follow",
    );
  } catch (error) {
    if (error instanceof FollowError) return { error: error.message };
    throw error;
  }
  revalidatePath("/discover");
  revalidatePath("/rooms/[roomId]", "page");
  return {};
}
