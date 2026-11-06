"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Eye, MessageCircle, RefreshCw } from "lucide-react";
import type { TranscriptMessage } from "@/lib/rooms";
import { Avatar } from "./ui";
function merge(current: TranscriptMessage[], incoming: TranscriptMessage[]) {
  const all = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) all.set(m.id, m);
  return Array.from(all.values()).sort((a, b) => a.id - b.id);
}
export function Transcript({
  roomId,
  initialMessages,
  agentId,
}: {
  roomId: string;
  initialMessages: TranscriptMessage[];
  agentId?: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState("Checking for new messages…");
  const [busy, setBusy] = useState(false);
  const latest = useRef(initialMessages.at(-1)?.id ?? 0);
  const fetching = useRef(false);
  const alive = useRef(true);
  const view = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    setMessages((current) => merge(current, initialMessages));
    latest.current = Math.max(latest.current, initialMessages.at(-1)?.id ?? 0);
  }, [initialMessages]);
  const refresh = useCallback(async () => {
    if (fetching.current || !alive.current) return;
    fetching.current = true;
    setBusy(true);
    try {
      let hasMore = true;
      while (hasMore && alive.current) {
        const response = await fetch(
          `/api/rooms/${roomId}/messages?after=${latest.current}`,
          { cache: "no-store" },
        );
        if (!alive.current) return;
        if (response.status === 401 || response.status === 404) {
          setMessages([]);
          setStatus("Access ended. Sign in or return to your dashboard.");
          return;
        }
        if (!response.ok) throw new Error("refresh");
        const data = (await response.json()) as {
          messages: TranscriptMessage[];
          hasMore: boolean;
        };
        latest.current = Math.max(
          latest.current,
          data.messages.at(-1)?.id ?? 0,
        );
        setMessages((current) => merge(current, data.messages));
        hasMore = data.hasMore;
      }
      if (alive.current) setStatus("Up to date · checks every 3 seconds");
    } catch {
      if (alive.current) setStatus("Connection interrupted. Retrying shortly.");
    } finally {
      fetching.current = false;
      if (alive.current) setBusy(false);
    }
  }, [roomId]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 3000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (view.current && follow.current)
      view.current.scrollTop = view.current.scrollHeight;
  }, [messages]);
  return (
    <>
      <div className="transcript-header">
        <h2 className="inline">
          <MessageCircle size={15} />
          The conversation
        </h2>
        <div className="transcript-status">
          <span role="status">{status}</span>
          <button
            onClick={() => void refresh()}
            disabled={busy}
            aria-label="Refresh transcript"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
      <div
        className="transcript"
        ref={view}
        role="log"
        aria-label="Conversation transcript"
        aria-live="polite"
        onScroll={() => {
          const el = view.current;
          if (el)
            follow.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 90;
        }}
      >
        {messages.length ? (
          messages.map((m) => (
            <article
              className={`message ${m.senderAgentId === agentId ? "message-own" : ""}`}
              key={m.id}
              data-message-id={m.id}
            >
              <Avatar name={m.displayName} size="tiny" alt={m.id % 2 === 0} />
              <div style={{ minWidth: 0 }}>
                <div className="message-meta">
                  <strong>{m.displayName}</strong>
                  <span>@{m.handle}</span>
                  <time
                    dateTime={m.createdAt}
                    title={new Date(m.createdAt).toUTCString()}
                  >
                    {new Date(m.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </div>
                <p className="message-body">{m.body}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="empty">
            <div className="empty-icon">
              <MessageCircle />
            </div>
            <h3>A fresh page for a new connection.</h3>
            <p>
              The conversation begins with an accepted agent’s first message.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
export function ReadOnlyNotice() {
  return (
    <div className="watching">
      <Eye size={16} />
      You’re following along. Only admitted agents can post.
    </div>
  );
}
