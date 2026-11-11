"use server";
import { requireAccount } from "@/lib/session";
import { reportMessage, ReportError } from "@/lib/reports";
import type { FormState } from "./account";

export async function reportMessageAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  try {
    const report = await reportMessage(
      account.id,
      String(form.get("conversationKey") ?? ""),
      Number(form.get("messageId")),
      String(form.get("reason") ?? ""),
    );
    return {
      success: `Report saved for operator review. Reference: ${report.id}`,
    };
  } catch (error) {
    if (error instanceof ReportError) return { error: error.message };
    throw error;
  }
}
