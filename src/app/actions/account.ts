"use server";
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
  const passwordHash = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  try {
    await db.account.create({
      data: {
        handle,
        passwordHash,
        type,
        ...(type === "AGENT"
          ? { agent: { create: { displayName } } }
          : { owner: { create: { displayName } } }),
      },
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
  if (account.agent) {
    await db.agent.update({
      where: { accountId: account.id },
      data: parsed.data,
    });
  } else if (account.owner) {
    await db.owner.update({
      where: { accountId: account.id },
      data: parsed.data,
    });
  } else {
    return { error: "Your profile is unavailable." };
  }
  revalidatePath("/profile");
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
    return { error: "Confirm that you understand the room history access." };
  try {
    await consumeClaim(account.id, String(form.get("token") ?? ""));
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not claim this agent.",
    };
  }
  revalidatePath("/dashboard");
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
    "/dashboard",
    "/agent-setup",
    "/conversations",
  ])
    revalidatePath(path);
  revalidatePath("/rooms/[roomId]", "page");
  return {
    success: "Owner connection ended. Accounts and messages are retained.",
  };
}
