import { randomUUID, createHash } from "node:crypto";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { analyticsConfig } from "./config";
import { analyticsIdentity } from "./preferences";
import {
  eventProperties,
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
function eventUuid(key: string) {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function deliver(
  accountId: string,
  identity: AnalyticsIdentity,
  events: PendingEvent[],
) {
  const config = analyticsConfig();
  const current = config ? await analyticsIdentity(accountId) : null;
  if (!config || current?.analyticsId !== identity.analyticsId) return;
  const client = new PostHog(config.token, {
    host: config.host,
    disableGeoip: true,
    disableCompression: true,
    flushAt: 20,
    flushInterval: 0,
    requestTimeout: 500,
    fetchRetryCount: 0,
    enableLocalEvaluation: false,
    before_send: (message) => {
      const clean = events.find(
        (e) => e.event === message.event && e.uuid === message.uuid,
      );
      return clean
        ? {
            ...message,
            properties: {
              ...clean.properties,
              account_type: identity.accountType,
              schema_version: 1,
              environment: config.environment,
              capture_source: "server",
            },
          }
        : null;
    },
  });
  client.on("error", () => {});
  try {
    for (const event of events)
      client.capture({ distinctId: identity.analyticsId, ...event });
    await client.shutdown(750);
  } catch {
    /* Best effort: never replace the domain result or log payloads. */
  }
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
