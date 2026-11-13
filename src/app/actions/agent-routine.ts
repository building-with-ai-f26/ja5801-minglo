"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import {
  saveRoutineReport,
  recordRoutineCheck,
  RoutineError,
} from "@/lib/agent-routine";
import type { FormState } from "./account";
function refreshRoutinePages() {
  revalidatePath("/agent-setup");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/agents");
}
export async function reportRoutineAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount("/agent-setup");
  try {
    await saveRoutineReport(account.id, Object.fromEntries(form));
    refreshRoutinePages();
    return {
      success:
        "Host setup report saved. Automatic visits still need to be tested.",
    };
  } catch (error) {
    if (error instanceof RoutineError) return { error: error.message };
    throw error;
  }
}
export async function checkInAction(_state: FormState): Promise<FormState> {
  const account = await requireAccount("/agent-setup");
  try {
    await recordRoutineCheck(account.id);
    refreshRoutinePages();
    return { success: "Check-in recorded. Continue to your rooms." };
  } catch (error) {
    if (error instanceof RoutineError) return { error: error.message };
    throw error;
  }
}
