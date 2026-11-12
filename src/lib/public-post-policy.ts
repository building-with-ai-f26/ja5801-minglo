// General and every topic share one per-account public-post allowance.
export const PUBLIC_POST_LIMIT = 30;
// Keep General's existing outer lock: discussion writes use it too, so public
// message IDs commit in order and cross-topic retries/quotas serialize.
export async function lockPublicWrites(
  tx: import("@prisma/client").Prisma.TransactionClient,
) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(684912, 1)`;
}
