import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { activityLabel } from "./activity";
import { handleSchema } from "./validation";
import { listPublicContributions } from "./public-contributions";

export const discoveryFilters = z.object({
  q: z
    .string()
    .trim()
    .max(60, "Keep searches under 60 characters.")
    .default(""),
  type: z.enum(["ALL", "AGENT", "OWNER"]).default("ALL"),
  view: z.enum(["search", "following"]).default("search"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type DiscoveryFilters = z.infer<typeof discoveryFilters>;
export const PAGE_SIZE = 20;
// Prisma contains filters use SQL LIKE. Treat user-entered %, _ and \ literally.
const literalSearch = (q: string) => q.replace(/[\\%_]/g, "\\$&");

const publicProfile = {
  id: true,
  handle: true,
  type: true,
  agent: { select: { displayName: true, bio: true, interests: true } },
  owner: { select: { displayName: true, bio: true, interests: true } },
} satisfies Prisma.AccountSelect;

export async function profileForViewer(
  viewerId: string,
  handle: string,
  cursor?: string,
) {
  const parsed = handleSchema.safeParse(handle);
  if (!parsed.success) return null;
  const account = await db.account.findUnique({
    where: { handle: parsed.data },
    select: {
      ...publicProfile,
      lastActiveAt: true,
      followers: {
        where: { followerId: viewerId },
        select: { followerId: true },
        take: 1,
      },
    },
  });
  if (!account) return null;
  const contributions = await listPublicContributions(
    viewerId,
    account.id,
    cursor,
  );
  return {
    id: account.id,
    handle: account.handle,
    type: account.type,
    displayName:
      account.agent?.displayName ??
      account.owner?.displayName ??
      account.handle,
    bio: account.agent?.bio ?? account.owner?.bio ?? "",
    interests: account.agent?.interests ?? account.owner?.interests ?? "",
    activity: activityLabel(account.lastActiveAt),
    isFollowing: account.followers.length > 0,
    contributions: contributions.items,
    contributionCursor: contributions.next,
    invalidContributionCursor: contributions.invalidCursor,
  };
}

export async function searchAccounts(viewerId: string, input: unknown) {
  const filters = discoveryFilters.parse(input);
  const q = literalSearch(filters.q.replace(/^@/, ""));
  const where: Prisma.AccountWhereInput = {
    id: { not: viewerId },
    ...(filters.type === "ALL" ? {} : { type: filters.type }),
    ...(filters.view === "following"
      ? { followers: { some: { followerId: viewerId } } }
      : {}),
    ...(q
      ? {
          OR: [
            { handle: { contains: q, mode: "insensitive" } },
            { agent: { displayName: { contains: q, mode: "insensitive" } } },
            { agent: { bio: { contains: q, mode: "insensitive" } } },
            { agent: { interests: { contains: q, mode: "insensitive" } } },
            { owner: { displayName: { contains: q, mode: "insensitive" } } },
            { owner: { bio: { contains: q, mode: "insensitive" } } },
            { owner: { interests: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const rows = await db.account.findMany({
    where,
    // Unknown activity stays at the end; handle provides deterministic tie ordering.
    orderBy: [
      { lastActiveAt: { sort: "desc", nulls: "last" } },
      { handle: "asc" },
    ],
    take: PAGE_SIZE + 1,
    skip: (filters.page - 1) * PAGE_SIZE,
    select: {
      ...publicProfile,
      lastActiveAt: true,
      followers: {
        where: { followerId: viewerId },
        select: { followerId: true },
        take: 1,
      },
    },
  });
  return {
    accounts: rows.slice(0, PAGE_SIZE).map((a) => ({
      id: a.id,
      handle: a.handle,
      type: a.type,
      displayName: a.agent?.displayName ?? a.owner?.displayName ?? a.handle,
      bio: a.agent?.bio ?? a.owner?.bio ?? "",
      interests: a.agent?.interests ?? a.owner?.interests ?? "",
      activity: activityLabel(a.lastActiveAt),
      isFollowing: a.followers.length > 0,
    })),
    hasMore: rows.length > PAGE_SIZE,
    filters,
  };
}
export class FollowError extends Error {}
export async function setFollowing(
  followerId: string,
  targetId: string,
  following: boolean,
) {
  if (!z.string().cuid().safeParse(targetId).success)
    throw new FollowError("Choose a valid account.");
  if (followerId === targetId)
    throw new FollowError("You can’t follow yourself.");
  if (!following) {
    await db.follow.deleteMany({ where: { followerId, targetId } });
    return;
  }
  const target = await db.account.findUnique({
    where: { id: targetId },
    select: { id: true },
  });
  if (!target) throw new FollowError("That account is no longer available.");
  try {
    // ON CONFLICT DO NOTHING makes repeated/concurrent follow requests idempotent.
    await db.follow.createMany({
      data: [{ followerId, targetId }],
      skipDuplicates: true,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    )
      throw new FollowError("That account is no longer available.");
    throw error;
  }
}
export async function followedAgentsForRoom(accountId: string, roomId: string) {
  const room = await db.room.findFirst({
    where: { id: roomId, creatorAccountId: accountId },
    select: { id: true },
  });
  if (!room)
    throw new FollowError(
      "Only the room creator can view these invitation shortcuts.",
    );
  const follows = await db.follow.findMany({
    where: {
      followerId: accountId,
      target: {
        type: "AGENT",
        agent: {
          memberships: {
            none: { roomId, status: { in: ["INVITED", "ACCEPTED"] } },
          },
        },
      },
    },
    orderBy: { target: { handle: "asc" } },
    take: 8,
    select: { target: { select: publicProfile } },
  });
  return follows.map(({ target }) => ({
    handle: target.handle,
    displayName: target.agent!.displayName,
  }));
}
