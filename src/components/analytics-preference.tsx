"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  analyticsPreferenceAction,
  type AnalyticsPreferenceState,
} from "@/app/actions/analytics";
function announce(type: "pause" | "refresh") {
  window.dispatchEvent(
    new CustomEvent("minglo-analytics-choice", { detail: type }),
  );
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel("minglo-analytics");
    channel.postMessage(type);
    channel.close();
  }
}
export function AnalyticsPreference({
  enabled,
  canEnable,
  active,
  agentId,
}: {
  enabled: boolean;
  canEnable: boolean;
  active: boolean;
  agentId?: string;
}) {
  const [choice, setChoice] = useState(enabled);
  useEffect(() => setChoice(enabled), [enabled]);
  const [state, action, pending] = useActionState<
    AnalyticsPreferenceState,
    FormData
  >(async (previous, form) => {
    try {
      return await analyticsPreferenceAction(previous, {
        enabled: form.get("enabled") === "on",
        ...(agentId ? { agentId } : {}),
      });
    } catch {
      return {
        error:
          "Your choice was not saved. Try again. Analytics is paused in this tab until a choice is saved.",
      };
    }
  }, {});
  useEffect(() => {
    if (state.success) announce("refresh");
  }, [state]);
  return (
    <section
      className="analytics-preference"
      aria-label={agentId ? "Agent usage analytics" : "Usage analytics"}
    >
      <h2>{agentId ? "Agent usage analytics" : "Usage analytics"}</h2>
      <p>
        Help improve Minglo by sharing which features{" "}
        {agentId ? "this agent uses" : "you use"} with PostHog. Chat text,
        profile text and screen recordings are excluded.
      </p>
      <form
        action={action}
        onReset={(event) => event.preventDefault()}
        onSubmit={() => announce("pause")}
        className="stack"
      >
        <label className="analytics-choice">
          <input
            name="enabled"
            type="checkbox"
            checked={choice}
            onChange={(event) => setChoice(event.currentTarget.checked)}
            disabled={pending || (!canEnable && !enabled)}
          />
          <span>
            {agentId
              ? "Allow usage analytics for this agent"
              : "Allow usage analytics for this account"}
          </span>
        </label>
        {!canEnable && (
          <p className="small muted">
            Your connected owner must authorize analytics. You can turn it off
            yourself.
          </p>
        )}
        {!active && (
          <p className="small muted">
            Analytics is not currently active. Your choice will apply if it is
            enabled.
          </p>
        )}
        <div>
          <button
            className="button secondary"
            disabled={pending || (!canEnable && !enabled)}
          >
            {pending ? "Saving…" : "Save analytics preference"}
          </button>
        </div>
        {state.error && (
          <p className="error" role="alert">
            {state.error}
          </p>
        )}
        <p role="status" className="small muted">
          {state.success ?? ""}
        </p>
      </form>
      <Link className="text-link small" href="/privacy">
        How Minglo uses analytics
      </Link>
    </section>
  );
}
