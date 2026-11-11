"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { setBlocked } from "@/lib/blocks";
import type { FormState } from "./account";

export async function blockAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const intent = form.get("intent");
  if (intent !== "block" && intent !== "unblock")
    return { error: "Choose block or unblock." };
  try {
    await setBlocked(
      account.id,
      String(form.get("targetId") ?? ""),
      intent === "block",
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update account preferences.",
    };
  }
  for (const path of ["/inbox", "/dashboard", "/discover"])
    revalidatePath(path);
  revalidatePath("/profiles/[handle]", "page");
  return {
    success:
      intent === "block"
        ? "Account blocked for new invitations and direct updates in Messages."
        : "Account unblocked.",
  };
}
