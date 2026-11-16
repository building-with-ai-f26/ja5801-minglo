import { z } from "zod";
const empty = z.object({}).strict();
const kind = z.enum(["public", "private", "direct", "discussion"]);
export const pageNames = [
  "home",
  "discover",
  "profile",
  "agents",
  "messages",
  "public_chat",
  "agent_room",
  "direct_chat",
  "topics",
  "topic",
  "discussion",
  "participation",
  "guide",
] as const;
export const eventSchemas = {
  account_registered: empty,
  page_viewed: z.object({ page_name: z.enum(pageNames) }).strict(),
  tour_started: z.object({ tour_version: z.literal(1) }).strict(),
  tour_completed: z.object({ tour_version: z.literal(1) }).strict(),
  tour_skipped: z.object({ tour_version: z.literal(1) }).strict(),
  agent_connection_created: empty,
  profile_updated: z
    .object({ has_introduction: z.boolean(), has_interests: z.boolean() })
    .strict(),
  follow_changed: z
    .object({
      following: z.boolean(),
      target_type: z.enum(["person", "agent"]),
    })
    .strict(),
  direct_request_created: empty,
  direct_request_accepted: empty,
  message_posted: z
    .object({ conversation_kind: kind, is_reply_to_other: z.boolean() })
    .strict(),
  topic_created: empty,
  discussion_created: empty,
  agent_activity_viewed: z
    .object({ conversation_kind: z.enum(["private", "direct"]) })
    .strict(),
  agent_checkin_recorded: empty,
  routine_status_changed: z
    .object({
      reported_status: z.enum([
        "NEEDS_APPROVAL",
        "REPORTED_READY",
        "UNAVAILABLE",
        "PAUSED",
      ]),
    })
    .strict(),
  participation_changed: z
    .object({ paused: z.boolean(), target_type: z.literal("agent") })
    .strict(),
} as const;
export type EventName = keyof typeof eventSchemas;
export type EventProperties<E extends EventName> = z.infer<
  (typeof eventSchemas)[E]
>;
export function eventProperties(
  event: string,
  input: unknown,
): Record<string, unknown> | null {
  if (!Object.hasOwn(eventSchemas, event)) return null;
  const parsed = eventSchemas[event as EventName].safeParse(input);
  return parsed.success ? parsed.data : null;
}
export function analyticsPage(path: string): (typeof pageNames)[number] | null {
  const fixed: Record<string, (typeof pageNames)[number]> = {
    "/dashboard": "home",
    "/discover": "discover",
    "/profile": "profile",
    "/agents": "agents",
    "/inbox": "messages",
    "/public-room": "public_chat",
    "/conversations": "agent_room",
    "/topics": "topics",
    "/topics/new": "topics",
    "/agent-setup": "participation",
    "/guide": "guide",
  };
  if (Object.hasOwn(fixed, path)) return fixed[path];
  if (/^\/profiles\/[a-z0-9_]{3,32}$/.test(path)) return "profile";
  if (/^\/rooms\/c[a-z0-9]+$/.test(path)) return "agent_room";
  if (/^\/messages\/c[a-z0-9]+$/.test(path)) return "direct_chat";
  if (/^\/messages\/new\/[a-z0-9_]{3,32}$/.test(path)) return "direct_chat";
  if (/^\/topics\/[a-z0-9-]+\/discussions\/c[a-z0-9]+$/.test(path))
    return "discussion";
  if (/^\/topics\/[a-z0-9-]+(?:\/new)?$/.test(path)) return "topic";
  return null;
}
export type AnalyticsIdentity = {
  analyticsId: string;
  accountType: "person" | "agent";
};
// Rebuild every payload rather than removing a few known secrets from SDK defaults.
export function safeBrowserEvent<
  T extends { event: string; properties?: Record<string, unknown> },
>(
  input: T,
  identity: AnalyticsIdentity,
  publicToken = "minglo-local-mock",
  environment: "test" | "production" = "test",
) {
  const {
    $set: ignoredSet,
    $set_once: ignoredOnce,
    ...transport
  } = input as T & { $set?: unknown; $set_once?: unknown };
  if (input.event === "$identify")
    return {
      ...transport,
      properties: {
        token: publicToken,
        $geoip_disable: true,
        distinct_id: identity.analyticsId,
        $anon_distinct_id: identity.analyticsId,
        $set: { account_type: identity.accountType },
      },
    };
  if (!["page_viewed", "agent_activity_viewed"].includes(input.event))
    return null;
  const props = input.properties ?? {};
  const allowed =
    input.event === "page_viewed"
      ? { page_name: props.page_name }
      : { conversation_kind: props.conversation_kind };
  const clean = eventProperties(input.event, allowed);
  if (!clean) return null;
  return {
    ...transport,
    properties: {
      token: publicToken,
      $geoip_disable: true,
      ...clean,
      distinct_id: identity.analyticsId,
      account_type: identity.accountType,
      schema_version: 1,
      environment,
      capture_source: "browser",
    },
  };
}
