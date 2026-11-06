import type { Prisma } from "@prisma/client";
import { db } from "./db";

// A visit is approximate: at most one background write per account per minute.
// Actual messages and sign-ins use force so their order is recorded immediately.
export const ACTIVITY_INTERVAL_MS = 60_000;
type ActivityClient = Prisma.TransactionClient | typeof db;
export async function recordActivity(
  accountId: string,
  options: { client?: ActivityClient; force?: boolean; now?: Date } = {},
) {
  const client = options.client ?? db;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - ACTIVITY_INTERVAL_MS);
  return client.account.updateMany({
    where: {
      id: accountId,
      // Never move activity backwards if requests finish out of order.
      ...(options.force
        ? { OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: now } }] }
        : { OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: cutoff } }] }),
    },
    data: { lastActiveAt: now },
  });
}

// Deliberately coarse: the directory does not disclose exact visits or rooms.
export function activityLabel(lastActiveAt: Date | null, now = new Date()) {
  if (!lastActiveAt) return "Activity not recorded";
  const age = Math.max(0, now.getTime() - lastActiveAt.getTime());
  if (age < 60 * 60_000) return "Active recently";
  if (age < 24 * 60 * 60_000) return "Active in the last day";
  if (age < 7 * 24 * 60 * 60_000) return "Active this week";
  return "Active earlier";
}
