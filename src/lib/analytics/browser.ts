import posthog from "posthog-js";
import { safeBrowserEvent, type AnalyticsIdentity } from "./events";
let identity: AnalyticsIdentity | null = null;
let initialized = false;
let publicToken = "";
let environment: "test" | "production" = "test";
export function stopBrowserAnalytics() {
  identity = null;
  if (initialized) {
    posthog.opt_out_capturing();
    posthog.reset();
  }
}
export function startBrowserAnalytics(
  next: AnalyticsIdentity & {
    host: string;
    token: string;
    environment: "test" | "production";
  },
) {
  stopBrowserAnalytics();
  identity = next;
  publicToken = next.token;
  environment = next.environment;
  if (!initialized) {
    posthog.init(next.token, {
      api_host: next.host,
      ip: false,
      debug: false,
      on_request_error: () => {},
      autocapture: false,
      // Minglo deliberately includes authorized agents and headless host browsers.
      opt_out_useragent_filter: true,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_conversations: true,
      disable_product_tours: true,
      enable_recording_console_log: false,
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
      capture_performance: false,
      capture_exceptions: false,
      capture_dead_clicks: false,
      rageclick: false,
      persistence: "memory",
      disable_persistence: true,
      save_referrer: false,
      save_campaign_params: false,
      request_batching: false,
      person_profiles: "identified_only",
      bootstrap: { distinctID: next.analyticsId, isIdentifiedID: true },
      before_send: (event) =>
        identity && event
          ? safeBrowserEvent(event, identity, publicToken, environment)
          : null,
    });
    initialized = true;
  }
  posthog.opt_in_capturing({ captureEventName: false });
  posthog.identify(next.analyticsId);
}
export function captureBrowserPage(
  pageName: string,
  observedKind?: "private" | "direct",
) {
  if (!identity) return;
  posthog.capture("page_viewed", { page_name: pageName });
  if (observedKind)
    posthog.capture("agent_activity_viewed", {
      conversation_kind: observedKind,
    });
}
