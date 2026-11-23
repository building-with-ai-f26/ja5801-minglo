"use server";
import {
  analyticsOperation,
  analyticsTransaction,
} from "@/lib/analytics/server";
import { after } from "next/server";
import { authRollout, emailAuthEnabled } from "@/lib/account-auth/config";
import {
  normalizeEmail,
  requestEmailVerification,
} from "@/lib/account-auth/service";
import { AuthError } from "next-auth";
import { hash, argon2id } from "argon2";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { registrationSchema, profileSchema, safeNext } from "@/lib/validation";
import { allowAttempt } from "@/lib/rate-limit";
import { requireAccount } from "@/lib/session";
import { issueClaim, consumeClaim, disconnectOwner } from "@/lib/claims";
import { requestSource } from "@/lib/request-source";
export type FormState = {
  error?: string;
  success?: string;
  claimToken?: string;
  expiresAt?: string;
};
export async function registerAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const h = await headers();
  const origin = requestSource(new Headers(h));
  if (!(await allowAttempt("register", origin, 30)))
    return { error: "Too many registrations. Try again in 15 minutes." };
  const { handle, password, type, displayName } = parsed.data;
  let recoveryEmail: string | undefined;
  if (type === "OWNER" && authRollout() === "public" && emailAuthEnabled()) {
    try {
      recoveryEmail = normalizeEmail(form.get("email"));
    } catch {
      return { error: "Add a valid recovery email for your human account." };
    }
    if (await db.account.findUnique({ where: { recoveryEmail } }))
      return {
        error:
          "That email is already connected. Sign in to your existing account or recover it.",
      };
  }
  const passwordHash = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  try {
    const created = await db.account.create({
      data: {
        handle,
        passwordHash,
        type,
        tourPreference: { create: {} },
        ...(type === "OWNER" && form.get("analyticsOptIn") === "on"
          ? {
              analyticsPreference: {
                create: { enabled: true, policyVersion: 1 },
              },
            }
          : {}),
        ...(type === "AGENT"
          ? { agent: { create: { displayName } } }
          : { owner: { create: { displayName } } }),
      },
    });
    if (recoveryEmail) {
      const email = recoveryEmail;
      after(async () => {
        try {
          await requestEmailVerification(
            {
              id: created.id,
              sessionVersion: created.sessionVersion,
              authenticatedAt: Date.now(),
            },
            email,
            "",
          );
        } catch {
          console.error(
            "Registration verification email delivery failed; resend is available in Settings.",
          );
        }
      });
    }
    await analyticsOperation(created.id, async (record) => {
      record("account_registered", {}, created.id, created.createdAt);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { error: "That handle is already taken. Choose another." };
    throw error;
  }
  await signIn("credentials", {
    handle,
    password,
    redirectTo: safeNext(form.get("next")),
  });
  return {};
}
export async function loginAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await signIn("credentials", {
      handle: form.get("handle"),
      password: form.get("password"),
      redirectTo: safeNext(form.get("next")),
    });
  } catch (error) {
    if (error instanceof AuthError)
      return {
        error:
          "Could not sign in. Check your handle and password, or try again in 15 minutes if you've made repeated attempts.",
      };
    throw error;
  }
  return {};
}
export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
export async function saveProfileAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!account.agent && !account.owner)
    return { error: "Your profile is unavailable." };
  await analyticsTransaction(account.id, async (tx, record) => {
    // Serialize on the edited profile row. Never lock Account before Agent:
    // message writes already take Agent before updating account activity.
    if (account.agent)
      await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "accountId" = ${account.id} FOR UPDATE`;
    else
      await tx.$queryRaw`SELECT "id" FROM "Owner" WHERE "accountId" = ${account.id} FOR UPDATE`;
    const before = account.agent
      ? await tx.agent.findUniqueOrThrow({ where: { accountId: account.id } })
      : await tx.owner.findUniqueOrThrow({ where: { accountId: account.id } });
    const changed =
      before.displayName !== parsed.data.displayName ||
      before.bio !== parsed.data.bio ||
      before.interests !== parsed.data.interests;
    if (!changed) return;
    if (account.agent)
      await tx.agent.update({
        where: { accountId: account.id },
        data: parsed.data,
      });
    else
      await tx.owner.update({
        where: { accountId: account.id },
        data: parsed.data,
      });
    record("profile_updated", {
      has_introduction: !!parsed.data.bio,
      has_interests: !!parsed.data.interests,
    });
  });
  revalidatePath("/profile");
  revalidatePath("/demo/github-profile");
  revalidatePath("/agents");
  revalidatePath("/agent-setup");
  revalidatePath("/discover");
  revalidatePath("/dashboard");
  revalidatePath(`/profiles/${account.handle}`);
  return { success: "Your profile has been saved." };
}
export async function issueClaimAction(): Promise<FormState> {
  const account = await requireAccount();
  if (!account.agent) return { error: "Only agents can create a claim link." };
  try {
    const result = await issueClaim(account.id);
    return { claimToken: result.token, expiresAt: result.expiresAt };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not create a claim link.",
    };
  }
}
export async function claimAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  if (form.get("confirm") !== "yes")
    return {
      error:
        "Confirm that you understand the room and direct chat history access.",
    };
  try {
    await consumeClaim(account.id, String(form.get("token") ?? ""));
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not claim this agent.",
    };
  }
  revalidatePath("/dashboard");
  revalidatePath("/agents");
  revalidatePath("/profile");
  revalidatePath("/agent-setup");
  revalidatePath("/conversations");
  revalidatePath("/inbox");
  redirect("/dashboard?claimed=1");
}

export async function disconnectOwnerAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount();
  if (form.get("confirm") !== "yes")
    return { error: "Confirm that you understand which access ends." };
  try {
    await disconnectOwner(account.id, String(form.get("agentId") ?? ""));
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not disconnect this relationship.",
    };
  }
  for (const path of [
    "/profile",
    "/agents",
    "/dashboard",
    "/agent-setup",
    "/conversations",
    "/inbox",
  ])
    revalidatePath(path);
  revalidatePath("/rooms/[roomId]", "page");
  revalidatePath("/messages/[id]", "page");
  return {
    success: "Owner connection ended. Accounts and messages are retained.",
  };
}
