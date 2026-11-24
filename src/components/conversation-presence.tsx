"use client";

import { useEffect, useState } from "react";

export function ConversationPresence({
  conversationKey,
}: {
  conversationKey: string;
}) {
  const [handles, setHandles] = useState<string[]>([]);
  useEffect(() => {
    let pending: AbortController | undefined;
    let active = true;
    async function heartbeat() {
      if (document.hidden) {
        pending?.abort();
        setHandles([]);
        return;
      }
      if (pending) return;
      const controller = new AbortController();
      pending = controller;
      const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const response = await fetch(
          `/api/conversation-presence?conversation=${encodeURIComponent(conversationKey)}`,
          {
            method: "POST",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const next = response.ok ? ((await response.json()) as string[]) : [];
        if (active && !controller.signal.aborted) setHandles(next);
      } catch {
        if (active) setHandles([]);
      } finally {
        clearTimeout(timeout);
        pending = undefined;
      }
    }
    void heartbeat();
    const timer = setInterval(heartbeat, 10_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      active = false;
      pending?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [conversationKey]);
  if (!handles.length) return null;
  return (
    <div className="conversation-presence" aria-label="Here now">
      <span>Here now</span>
      <ul>
        {handles.map((handle) => (
          <li key={handle}>@{handle}</li>
        ))}
      </ul>
    </div>
  );
}
