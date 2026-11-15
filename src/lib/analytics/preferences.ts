import { db } from "../db";
import { analyticsConfig } from "./config";
import type { AnalyticsIdentity } from "./events";
export const ANALYTICS_POLICY_VERSION = 1;
export async function analyticsIdentity(
  accountId: string,
): Promise<AnalyticsIdentity | null> {
  try {
    const account = await db.account.findUnique({
      where: { id: accountId },
      select: {
        type: true,
        analyticsPreference: true,
        agent: { select: { owner: { select: { accountId: true } } } },
      },
    });
    const p = account?.analyticsPreference;
    if (!account || !p?.enabled || p.policyVersion !== ANALYTICS_POLICY_VERSION)
      return null;
    if (
      account.type === "AGENT" &&
      (!account.agent?.owner ||
        p.approvedByAccountId !== account.agent.owner.accountId)
    )
      return null;
    return {
      analyticsId: p.analyticsId,
      accountType: account.type === "AGENT" ? "agent" : "person",
    };
  } catch {
    return null;
  }
}
export async function setAnalyticsPreference(
  actorId: string,
  enabled: boolean,
  agentId?: string,
) {
  return db.$transaction(async (tx) => {
    const actor = await tx.account.findUniqueOrThrow({
      where: { id: actorId },
      select: { type: true, agent: { select: { id: true } } },
    });
    const targetAgentId = agentId ?? actor.agent?.id;
    let subjectId = actorId;
    let approvedByAccountId: string | null = null;
    if (targetAgentId) {
      await tx.$queryRaw`SELECT "id" FROM "Agent" WHERE "id" = ${targetAgentId} FOR UPDATE`;
      const agent = await tx.agent.findUnique({
        where: { id: targetAgentId },
        select: { accountId: true, owner: { select: { accountId: true } } },
      });
      if (
        !agent ||
        (agent.owner?.accountId !== actorId && agent.accountId !== actorId)
      )
        throw new Error(
          "Only the agent or its current owner can change this preference.",
        );
      if (enabled && agent.owner?.accountId !== actorId)
        throw new Error(
          "Your connected owner must authorize analytics for this agent.",
        );
      subjectId = agent.accountId;
      approvedByAccountId = enabled ? actorId : null;
    } else if (actor.type !== "OWNER")
      throw new Error("Your analytics preference is unavailable.");
    await tx.analyticsPreference.upsert({
      where: { accountId: subjectId },
      create: {
        accountId: subjectId,
        enabled,
        approvedByAccountId,
        policyVersion: ANALYTICS_POLICY_VERSION,
      },
      update: {
        enabled,
        approvedByAccountId,
        policyVersion: ANALYTICS_POLICY_VERSION,
      },
    });
    return { enabled };
  });
}
export async function browserAnalyticsState(accountId: string) {
  const config = analyticsConfig();
  if (!config) return null;
  const identity = await analyticsIdentity(accountId);
  return identity
    ? { ...identity, ...config, expiresAt: Date.now() + 60_000 }
    : null;
}
