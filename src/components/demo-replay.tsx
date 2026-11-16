"use client";
import { useEffect, useRef, useState } from "react";
import { startBoundedReplay } from "../../docs/bounded-replay.js";

export function DemoReplay() {
  const stop = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const lease = useRef(0);
  const [status, setStatus] = useState(
    "Recording is off. Usage analytics consent does not allow recording.",
  );
  const [active, setActive] = useState(false);
  const cancel = () => {
    generation.current++;
    lease.current = 0;
    stop.current?.();
    stop.current = null;
    setActive(false);
  };
  useEffect(() => {
    const pause = () => cancel();
    const channel =
      "BroadcastChannel" in window
        ? new BroadcastChannel("minglo-analytics")
        : null;
    if (channel) channel.onmessage = pause;
    window.addEventListener("minglo-analytics-choice", pause);
    return () => {
      generation.current++;
      lease.current = 0;
      stop.current?.();
      channel?.close();
      window.removeEventListener("minglo-analytics-choice", pause);
    };
  }, []);
  async function start() {
    cancel();
    const current = generation.current;
    setActive(true);
    setStatus("Checking your analytics choice…");
    try {
      const response = await fetch("/api/analytics/eligibility", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const state = response.ok ? await response.json() : null;
      if (generation.current !== current) return;
      if (
        !state ||
        state.environment !== "verification" ||
        state.host !== "https://us.i.posthog.com" ||
        state.expiresAt <= Date.now()
      )
        throw new Error(
          "Enable usage analytics below and save first. The approved local demo configuration must also be active.",
        );
      const { default: posthog } = await import("posthog-js");
      if (generation.current !== current) return;
      lease.current = Math.min(state.expiresAt, Date.now() + 60_000);
      stop.current = startBoundedReplay(
        posthog,
        state.token,
        () => generation.current === current && Date.now() < lease.current,
        (message: string) => {
          setStatus(message);
          if (message.startsWith("Recording stopped")) setActive(false);
        },
      );
    } catch (error) {
      if (generation.current !== current) return;
      generation.current++;
      lease.current = 0;
      setActive(false);
      setStatus(
        error instanceof Error
          ? error.message
          : "Recording could not start. Try again.",
      );
    }
  }
  return (
    <section className="demo-replay" aria-labelledby="demo-replay-heading">
      <h2 id="demo-replay-heading">Optional demo recording</h2>
      <p>
        Allow PostHog to record this demo page for up to one minute. All text,
        inputs, attributes and images are masked or blocked. This reduces visual
        detail. Chats and other app screens are excluded. Switching tabs or
        leaving stops the recording.
      </p>
      <div className="inline">
        <button
          type="button"
          className="button secondary"
          disabled={active}
          onClick={start}
        >
          Allow this demo recording
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={!active}
          onClick={cancel}
        >
          Stop demo recording
        </button>
      </div>
      <p role="status" className="small muted">
        {status}
      </p>
    </section>
  );
}
