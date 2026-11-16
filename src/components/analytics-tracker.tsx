"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analyticsPage } from "@/lib/analytics/events";
import type { browserAnalyticsState } from "@/lib/analytics/preferences";
type State = NonNullable<Awaited<ReturnType<typeof browserAnalyticsState>>>;
type Browser = typeof import("@/lib/analytics/browser");
export function AnalyticsTracker() {
  const path = usePathname();
  const sdk = useRef<Browser | null>(null);
  const last = useRef("");
  const paused = useRef(false);
  useEffect(() => {
    let closed = false;
    let checking = false;
    let revision = 0;
    let identity = "";
    let leaseTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      revision++;
      sdk.current?.stopBrowserAnalytics();
      identity = "";
      clearTimeout(leaseTimer);
    };
    if (!analyticsPage(path)) {
      stop();
      paused.current = false;
    }
    const refresh = async () => {
      if (checking || paused.current || closed) return;
      const page = analyticsPage(path);
      if (!page || document.hidden || !document.querySelector("#main")) {
        stop();
        return;
      }
      checking = true;
      const generation = revision;
      try {
        const response = await fetch("/api/analytics/eligibility", {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.timeout(5000),
        });
        const state: State | null = response.ok ? await response.json() : null;
        if (closed || generation !== revision || paused.current) return;
        if (!state || state.expiresAt <= Date.now()) {
          stop();
          return;
        }
        // Configuration is supplied only after current server eligibility checks.
        const module = sdk.current ?? (await import("@/lib/analytics/browser"));
        if (
          closed ||
          generation !== revision ||
          document.hidden ||
          paused.current
        )
          return;
        sdk.current = module;
        if (identity !== state.analyticsId) {
          module.startBrowserAnalytics(state);
          identity = state.analyticsId;
        }
        clearTimeout(leaseTimer);
        leaseTimer = setTimeout(
          stop,
          Math.max(0, state.expiresAt - Date.now()),
        );
        const key = `${state.analyticsId}:${path}`;
        if (last.current !== key) {
          last.current = key;
          const observed = document.querySelector<HTMLElement>(
            "[data-analytics-agent-view]",
          )?.dataset.analyticsAgentView;
          module.captureBrowserPage(
            page,
            observed === "private" || observed === "direct"
              ? observed
              : undefined,
          );
        }
      } catch {
        stop();
      } finally {
        checking = false;
      }
    };
    const choice = (value: unknown) => {
      stop();
      paused.current = value !== "refresh";
      if (!paused.current) void refresh();
    };
    const onChoice = (event: Event) => choice((event as CustomEvent).detail);
    const channel =
      "BroadcastChannel" in window
        ? new BroadcastChannel("minglo-analytics")
        : null;
    if (channel) channel.onmessage = (event) => choice(event.data);
    const visibility = () => {
      if (document.hidden) stop();
      else void refresh();
    };
    const submit = (event: Event) => {
      if ((event.target as HTMLElement)?.matches("[data-analytics-stop]")) {
        paused.current = true;
        last.current = "";
        stop();
      }
    };
    window.addEventListener("minglo-analytics-choice", onChoice);
    window.addEventListener("focus", visibility);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("submit", submit, true);
    const timer = setInterval(() => {
      void refresh();
    }, 50_000);
    // Navigating away from sign-out/authentication may establish a new session.
    if (analyticsPage(path) && !paused.current) void refresh();
    return () => {
      closed = true;
      stop();
      channel?.close();
      clearInterval(timer);
      window.removeEventListener("minglo-analytics-choice", onChoice);
      window.removeEventListener("focus", visibility);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("submit", submit, true);
    };
  }, [path]);
  return null;
}
