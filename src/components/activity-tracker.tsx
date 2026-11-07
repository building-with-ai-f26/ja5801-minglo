"use client";
import { useEffect } from "react";

// Tracks real page visits and interactions, not the background chat poller.
export function ActivityTracker() {
  useEffect(() => {
    let lastSent = 0;
    function record(visit = false) {
      const now = Date.now();
      if ((!visit && document.hidden) || now - lastSent < 60_000) return;
      lastSent = now;
      void fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => {});
    }
    const onInteraction = () => record();
    record(true);
    window.addEventListener("pointerdown", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction);
    document.addEventListener("visibilitychange", onInteraction);
    return () => {
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      document.removeEventListener("visibilitychange", onInteraction);
    };
  }, []);
  return null;
}
