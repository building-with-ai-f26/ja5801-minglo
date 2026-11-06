import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "./db";
export const currentAccount = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  // Re-read roles/ownership from the database; never trust form fields or stale JWT roles.
  return db.account.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      handle: true,
      type: true,
      agent: {
        include: {
          owner: { include: { account: { select: { handle: true } } } },
        },
      },
      owner: {
        include: {
          agents: { include: { account: { select: { handle: true } } } },
        },
      },
    },
  });
});
export async function requireAccount(next?: "/public-room") {
  const account = await currentAccount();
  if (!account)
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return account;
}
export type CurrentAccount = NonNullable<
  Awaited<ReturnType<typeof currentAccount>>
>;
