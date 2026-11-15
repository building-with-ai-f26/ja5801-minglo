import { randomUUID, createHmac } from "node:crypto";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { analyticsConfig } from "./config";
import { analyticsIdentity } from "./preferences";
import {
  eventProperties,
  eventSchemas,
  type EventName,
  type EventProperties,
  type AnalyticsIdentity,
} from "./events";

export type RecordAnalytics = <E extends EventName>(
  event: E,
  properties: EventProperties<E>,
  operationKey?: string,
  timestamp?: Date,
) => void;
type PendingEvent = {
  event: EventName;
  properties: Record<string, unknown>;
  uuid: string;
  timestamp: Date;
};
let active = 0;
const pending = new Set<Promise<void>>();
let sdk: PostHog | null = null;
let sdkHost = "";
async function clientFor(
  config: NonNullable<ReturnType<typeof analyticsConfig>>,
) {
  if (sdk && sdkHost === config.host) return sdk;
  const previous = sdk;
  if (previous) await previous.shutdown(750).catch(() => {});
  sdkHost = config.host;
  sdk = new PostHog(config.token, {
    host: config.host,
    disableGeoip: true,
    disableCompression: true,
    flushInterval: 0,
    requestTimeout: 500,
    fetchRetryCount: 0,
    enableLocalEvaluation: false,
    before_send: (message) => {
      if (!Object.hasOwn(eventSchemas, message.event)) return null;
      const props = message.properties ?? {};
      const fields = Object.fromEntries(
        Object.keys(eventSchemas[message.event as EventName].shape).map(
          (key) => [key, props[key]],
        ),
      );
      const clean = eventProperties(message.event, fields);
      if (!clean || !["person", "agent"].includes(String(props.account_type)))
        return null;
      return {
        ...message,
        $set: undefined,
        $set_once: undefined,
        properties: {
          ...clean,
          account_type: props.account_type,
          schema_version: 1,
          environment: "test",
          capture_source: "server",
          $geoip_disable: true,
        },
      };
    },
  });
  sdk.on("error", () => {});
  return sdk;
}
function eventUuid(key: string) {
  const h = createHmac("sha256", process.env.AUTH_SECRET ?? "local-mock")
    .update(key)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function deliver(
  accountId: string,
  identity: AnalyticsIdentity & { consentVersion: number },
  events: PendingEvent[],
) {
  const config = analyticsConfig();
  const current = config ? await analyticsIdentity(accountId) : null;
  if (
    !config ||
    current?.analyticsId !== identity.analyticsId ||
    current.consentVersion !== identity.consentVersion
  )
    return;
  const client = await clientFor(config);
  // No SDK background queue: all sends are awaited by Next's post-response work.
  await Promise.allSettled(
    events.map((event) =>
      client.captureImmediate({
        distinctId: identity.analyticsId,
        ...event,
        properties: { ...event.properties, account_type: identity.accountType },
      }),
    ),
  );
}
export async function analyticsOperation<T>(
  accountId: string,
  work: (record: RecordAnalytics) => Promise<T>,
): Promise<T> {
  const identity = analyticsConfig()
    ? await analyticsIdentity(accountId)
    : null;
  const events: PendingEvent[] = [];
  const record: RecordAnalytics = (
    event,
    properties,
    key = randomUUID(),
    timestamp = new Date(),
  ) => {
    if (!identity || events.length >= 8) return;
    const clean = eventProperties(event, properties);
    if (clean)
      events.push({
        event,
        properties: clean,
        uuid: eventUuid(`${identity.analyticsId}:${event}:${key}`),
        timestamp,
      });
  };
  const result = await work(record);
  if (identity && events.length && active < 50) {
    active++;
    const send = async () => {
      try {
        await deliver(accountId, identity, events);
      } catch {
      } finally {
        active--;
      }
    };
    try {
      after(send);
    } catch {
      // Direct domain tests/CLI have no Next request lifecycle. Track their work
      // explicitly so tests can await it; this fallback remains mock-only.
      const task = send();
      pending.add(task);
      void task.finally(() => pending.delete(task));
    }
  }
  return result;
}
export function analyticsTransaction<T>(
  accountId: string,
  work: (tx: Prisma.TransactionClient, record: RecordAnalytics) => Promise<T>,
) {
  return analyticsOperation(accountId, (record) =>
    db.$transaction((tx) => work(tx, record)),
  );
}
export async function flushMockAnalytics() {
  await Promise.allSettled([...pending]);
}
export async function shutdownMockAnalytics() {
  await flushMockAnalytics();
  const client = sdk;
  sdk = null;
  sdkHost = "";
  if (client) await client.shutdown(750).catch(() => {});
}
