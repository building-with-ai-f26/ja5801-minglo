"use server";
import { AuthError } from "next-auth";
import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { auth, signIn, signOut } from "@/auth";
import { requireAccount } from "@/lib/session";
import { requestSource } from "@/lib/request-source";
import { allowAttempt } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { safeNext } from "@/lib/validation";
import {
  AUTH_COOKIE,
  INTENT_COOKIE,
  cookieOptions,
  emailAuthEnabled,
  googleEnabled,
} from "@/lib/account-auth/config";
import {
  AccountAuthError,
  createGoogleIntent,
  linkGoogle,
  readAuthToken,
  requestEmailVerification,
  requestPasswordReset,
  resetEmailPassword,
  setAccountPassword,
  tokenDigest,
  unlinkGoogle,
  verifyRecoveryEmail,
  type RecentActor,
} from "@/lib/account-auth/service";
import type { FormState } from "./account";

const field = (form: FormData, key: string) => String(form.get(key) ?? "");
async function source() {
  return requestSource(new Headers(await headers()));
}
async function actor(): Promise<RecentActor> {
  const session = await auth();
  const account = await requireAccount("/settings");
  if (account.type !== "OWNER" || session?.sessionVersion === undefined)
    throw new AccountAuthError("This setting is for your human account.");
  if (
    !(await allowAttempt(
      "signin-settings",
      `${await source()}:${account.id}`,
      12,
    ))
  )
    throw new AccountAuthError("Too many attempts. Try again in 15 minutes.");
  return {
    id: account.id,
    sessionVersion: session.sessionVersion,
    authenticatedAt: session.authenticatedAt,
  };
}
function failure(error: unknown): FormState {
  if (error instanceof AccountAuthError) {
    // A page opened during recent authentication may now be stale. Refresh its
    // password/reverification controls when the server rejects that proof.
    revalidatePath("/settings");
    return { error: error.message };
  }
  console.error("Account settings operation failed.");
  return { error: "We couldn't complete that change. Please try again." };
}
export async function startGoogleAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!googleEnabled())
    return { error: "Google sign-in is not available yet." };
  if (!(await allowAttempt("google-start", await source(), 30)))
    return { error: "Too many attempts. Try again later." };
  const jar = await cookies();
  const next = safeNext(form.get("next"));
  jar.delete(AUTH_COOKIE);
  jar.delete(INTENT_COOKIE);
  if (form.get("link") === "yes") {
    try {
      const token = await createGoogleIntent(
        await actor(),
        field(form, "currentPassword"),
        "/settings",
      );
      jar.set(INTENT_COOKIE, token, cookieOptions());
    } catch (error) {
      return failure(error);
    }
  }
  const token = randomBytes(32).toString("base64url");
  await db.accountAuthToken.create({
    data: {
      tokenHash: tokenDigest(token),
      purpose: "google-next",
      nextPath: next,
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
  jar.set("minglo-google-next", token, cookieOptions());
  await signIn("google", { redirectTo: next });
  return {};
}
export async function completeGoogleSignupAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const proof = await readAuthToken(
    (await cookies()).get(AUTH_COOKIE)?.value ?? "",
    "google-profile",
  );
  if (!proof)
    return {
      error: "Your Google confirmation expired. Start Google sign-in again.",
    };
  if (form.get("newAccount") !== "yes")
    return {
      error: "Choose to create a new account or connect your existing one.",
    };
  try {
    await signIn("google-complete", {
      handle: form.get("handle"),
      displayName: form.get("displayName"),
      redirectTo: safeNext(proof.nextPath),
    });
  } catch (error) {
    if (error instanceof AuthError)
      return {
        error:
          "Couldn't create the account. That handle, email or Google identity may already be in use. Sign in to your existing account to connect Google, or try another handle.",
      };
    throw error;
  }
  return {};
}
export async function connectPendingGoogleAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await linkGoogle(
      await actor(),
      field(form, "currentPassword"),
      (await cookies()).get(AUTH_COOKIE)?.value ?? "",
    );
  } catch (error) {
    return failure(error);
  }
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/settings?connected=1");
}
export async function verifyEmailRequestAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const current = await actor();
    if (!(await allowAttempt("email-verify-send", current.id, 3, db, 3600)))
      return { error: "Too many email requests. Try again in an hour." };
    await requestEmailVerification(
      current,
      form.get("email"),
      field(form, "currentPassword"),
    );
    revalidatePath("/settings");
    return {
      success:
        "Check your inbox for a verification link. Your current recovery email stays active until you confirm the new one.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function confirmEmailAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  try {
    await verifyRecoveryEmail(field(form, "token"), account.id);
  } catch (error) {
    return failure(error);
  }
  redirect("/settings?verified=1");
}
export async function forgotPasswordAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const origin = await source();
  const input = field(form, "email");
  if (
    emailAuthEnabled() &&
    (await allowAttempt("email-reset-source", origin, 10, db, 3600))
  ) {
    after(async () => {
      try {
        await requestPasswordReset(input, origin);
      } catch {
        console.error("Password recovery email delivery failed.");
      }
    });
  }
  return {
    success:
      "If this email is connected to an eligible account, we'll send instructions. Check your inbox and spam folder.",
  };
}
export async function resetEmailPasswordAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!(await allowAttempt("email-reset-consume", await source(), 20)))
    return { error: "Too many attempts. Try again in 15 minutes." };
  if (field(form, "newPassword") !== field(form, "confirmPassword"))
    return { error: "The passwords don't match." };
  try {
    await resetEmailPassword(field(form, "token"), field(form, "newPassword"));
  } catch (error) {
    return failure(error);
  }
  await signOut({ redirectTo: "/login?recovered=1" });
  return {};
}
export async function setPasswordAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (field(form, "newPassword") !== field(form, "confirmPassword"))
    return { error: "The passwords don't match." };
  try {
    await setAccountPassword(
      await actor(),
      field(form, "newPassword"),
      field(form, "currentPassword"),
    );
  } catch (error) {
    return failure(error);
  }
  await signOut({ redirectTo: "/login?recovered=1" });
  return {};
}
export async function disconnectGoogleAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await unlinkGoogle(await actor(), field(form, "currentPassword"));
  } catch (error) {
    return failure(error);
  }
  await signOut({ redirectTo: "/login" });
  return {};
}
export async function dismissAuthNoticeAction() {
  const account = await requireAccount();
  if (account.type !== "OWNER") return;
  await db.accountAuthNotice.upsert({
    where: { accountId: account.id },
    create: {
      accountId: account.id,
      dismissals: 1,
      remindAt: new Date(Date.now() + 7 * 86400_000),
    },
    update: {
      dismissals: { increment: 1 },
      remindAt: new Date(Date.now() + 7 * 86400_000),
    },
  });
  revalidatePath("/", "layout");
}
