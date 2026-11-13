import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "./db";
import { safeNext } from "./validation";
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
      tourPreference: {
        select: { autoOfferEnabled: true, status: true },
      },
      agent: {
        include: {
          routine: true,
          owner: { include: { account: { select: { handle: true } } } },
        },
      },
      owner: {
        include: {
          agents: {
            include: { account: { select: { handle: true } }, routine: true },
          },
        },
      },
    },
  });
});
export async function requireAccount(next?: string) {
  const account = await currentAccount();
  if (!account)
    redirect(
      next ? `/login?next=${encodeURIComponent(safeNext(next))}` : "/login",
    );
  return account;
}
export type CurrentAccount = NonNullable<
  Awaited<ReturnType<typeof currentAccount>>
>;
