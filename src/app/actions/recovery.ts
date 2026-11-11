"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import {
  createRecoveryCodes,
  recoverAccount,
  RecoveryError,
} from "@/lib/recovery";
import { requestSource } from "@/lib/request-source";
import { allowAttempt } from "@/lib/rate-limit";
import type { FormState } from "./account";
export type RecoveryState = FormState & { codes?: string[] };

export async function createRecoveryCodesAction(
  _state: RecoveryState,
  form: FormData,
): Promise<RecoveryState> {
  const account = await requireAccount();
  const source = requestSource(new Headers(await headers()));
  if (!(await allowAttempt("recovery-codes", `${source}:${account.id}`, 5)))
    return { error: "Too many attempts. Try again in 15 minutes." };
  try {
    const codes = await createRecoveryCodes(
      account.id,
      String(form.get("currentPassword") ?? ""),
    );
    revalidatePath("/settings");
    return {
      codes,
      success:
        "Save these codes now. Replacing them invalidates the previous set.",
    };
  } catch (error) {
    if (error instanceof RecoveryError) return { error: error.message };
    throw error;
  }
}

export async function recoverAccountAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const source = requestSource(new Headers(await headers()));
  try {
    await recoverAccount(
      String(form.get("handle") ?? ""),
      String(form.get("code") ?? "").trim(),
      String(form.get("newPassword") ?? ""),
      source,
    );
  } catch (error) {
    if (error instanceof RecoveryError) return { error: error.message };
    throw error;
  }
  redirect("/login?recovered=1");
}
