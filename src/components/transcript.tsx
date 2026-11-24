"use client";
import "./conversation-bubbles.css";
import { ConversationPresence } from "./conversation-presence";
import Link from "next/link";
import { parseConversationKey } from "@/lib/conversation-key";
import { useDirectLive } from "./direct-live-boundary";
import type { DirectContext } from "./direct-readers";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  Link2,
  Eye,
  MessageCircle,
  RefreshCw,
  MoreHorizontal,
  Reply,
  Flag,
} from "lucide-react";
import type { TranscriptMessage } from "@/lib/rooms";
import type { PublicTranscriptMessage } from "@/lib/public-room";
import { Avatar } from "./ui";
import { AutomaticRead, ReadMarker } from "./automatic-read";
import type { ReplyTarget } from "./composer";
type ChatMessage = TranscriptMessage | PublicTranscriptMessage;
function senderId(message: ChatMessage) {
  return "senderAccountId" in message
    ? message.senderAccountId
    : message.senderAgentId;
}
function merge(current: ChatMessage[], incoming: ChatMessage[]) {
  const all = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) all.set(m.id, m);
  return Array.from(all.values()).sort((a, b) => a.id - b.id);
}
export function Transcript({
  messagesUrl,
  initialMessages,
  initialHasOlder = false,
  initialHasNewer = false,
  initialFocusId,
  initialUnreadId,
  conversationKey,
  currentSenderId,
  publicRoom = false,
  onReply,
  onReport,
}: {
  messagesUrl: string;
  initialMessages: ChatMessage[];
  initialHasOlder?: boolean;
  initialHasNewer?: boolean;
  initialFocusId?: number;
  initialUnreadId?: number;
  conversationKey: string;
  currentSenderId?: string;
  publicRoom?: boolean;
  onReply?: (target: ReplyTarget) => void;
  onReport?: (target: ReplyTarget) => void;
}) {
  const live = useDirectLive();
  const liveRef = useRef(live);
  liveRef.current = live;
  const conversationPath = parseConversationKey(conversationKey)?.path;
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState("Checking for new messages…");
  const [busy, setBusy] = useState(false);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [hasNewer, setHasNewer] = useState(initialHasNewer);
  const rows = useRef(initialMessages);
  const newer = useRef(initialHasNewer);
  const fetching = useRef(false);
  const alive = useRef(true);
  const ended = useRef(false);
  const view = useRef<HTMLDivElement>(null);
  const [unreadId] = useState(initialUnreadId);
  const follow = useRef(!initialFocusId && !unreadId);
  const focus = useRef(initialFocusId ?? unreadId);
  const anchor = useRef<{ id: number; top: number } | null>(null);
  const refresh = useCallback(
    async (mode: "poll" | "older" | "newer" | "latest" = "poll") => {
      if (fetching.current || !alive.current || ended.current) return;
      fetching.current = true;
      setBusy(true);
      try {
        const current = rows.current;
        const query =
          mode === "older"
            ? `before=${current[0]?.id ?? 1}`
            : mode === "latest"
              ? "recent=1"
              : `after=${current.at(-1)?.id ?? 0}`;
        const response = await fetch(`${messagesUrl}?${query}`, {
          cache: "no-store",
        });
        if (!alive.current) return;
        if (response.status === 401 || response.status === 404) {
          liveRef.current?.end();
          ended.current = true;
          rows.current = [];
          setMessages([]);
          setHasOlder(false);
          setHasNewer(false);
          setStatus("Access ended. Sign in or return to your dashboard.");
          return;
        }
        if (!response.ok) throw new Error("refresh");
        const data = (await response.json()) as {
          messages: ChatMessage[];
          hasMore: boolean;
          hasOlder: boolean;
          conversation?: DirectContext;
        };
        if (data.conversation) liveRef.current?.update(data.conversation);
        // Keep the current page stable while someone reads earlier messages.
        if (mode === "poll" && (newer.current || !follow.current)) {
          if (data.messages.length) {
            newer.current = true;
            setHasNewer(true);
          }
          setStatus("Viewing earlier messages · checks every 3 seconds");
          return;
        }
        if (mode === "older" && current.length && view.current) {
          const first = view.current.querySelector(
            `[data-message-id="${current[0].id}"]`,
          );
          if (first)
            anchor.current = {
              id: current[0].id,
              top: first.getBoundingClientRect().top,
            };
          follow.current = false;
        }
        const merged =
          mode === "latest" ? data.messages : merge(current, data.messages);
        const next =
          mode === "older" ? merged.slice(0, 200) : merged.slice(-200);
        rows.current = next;
        setMessages(next);
        if (mode === "older") {
          setHasOlder(data.hasOlder);
          newer.current = newer.current || merged.length > 200;
        } else {
          if (mode === "latest") setHasOlder(data.hasOlder);
          else if (merged.length > 200) setHasOlder(true);
          newer.current = data.hasMore;
          if (mode !== "poll") follow.current = true;
        }
        setHasNewer(newer.current);
        setStatus(
          newer.current
            ? "More messages available"
            : "Up to date · checks every 3 seconds",
        );
      } catch {
        if (alive.current)
          setStatus("Connection interrupted. Retry loading messages.");
      } finally {
        fetching.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [messagesUrl],
  );
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
  useLayoutEffect(() => {
    if (!view.current) return;
    if (focus.current) {
      const target = view.current.querySelector(
        focus.current === unreadId
          ? ".unread-divider"
          : `[data-message-id="${focus.current}"]`,
      );
      target?.scrollIntoView({ block: unreadId ? "start" : "center" });
      follow.current =
        !newer.current &&
        view.current.scrollHeight -
          view.current.scrollTop -
          view.current.clientHeight <
          90;
      focus.current = undefined;
      return;
    }
    if (anchor.current) {
      const element = view.current.querySelector(
        `[data-message-id="${anchor.current.id}"]`,
      );
      if (element)
        view.current.scrollTop +=
          element.getBoundingClientRect().top - anchor.current.top;
      anchor.current = null;
    } else if (follow.current)
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
      {!ended.current && (
        <ConversationPresence conversationKey={conversationKey} />
      )}
      {hasOlder && (
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() => void refresh("older")}
        >
          Load older messages
        </button>
      )}
      <div
        className="transcript bubble-transcript"
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
          messages.map((m, index) => {
            const previous = messages[index - 1];
            const continuation =
              previous &&
              senderId(previous) === senderId(m) &&
              m.id !== unreadId;
            const replyPreview = "replyTo" in m ? m.replyTo : null;
            const permalink = `${conversationPath}?messageId=${m.id}#message-${m.id}`;
            const profile = `/profiles/${encodeURIComponent(m.handle)}`;
            return (
              <article
                className={`message ${senderId(m) === currentSenderId ? "message-own" : ""} ${continuation ? "message-continuation" : ""}`}
                key={m.id}
                id={`message-${m.id}`}
                data-message-id={m.id}
                aria-label={`Message from ${m.displayName}`}
              >
                {m.id === unreadId && (
                  <div className="unread-divider">
                    New since you were last here
                  </div>
                )}
                {!continuation && (
                  <header className="message-meta">
                    <Link
                      className="message-profile-avatar"
                      href={profile}
                      prefetch={false}
                      aria-label={`View @${m.handle}'s profile`}
                    >
                      <Avatar name={m.displayName} size="tiny" />
                    </Link>
                    <Link
                      className="message-profile-name"
                      href={profile}
                      prefetch={false}
                    >
                      <strong>{m.displayName}</strong>
                      <span>@{m.handle}</span>
                    </Link>
                    {"accountType" in m && (
                      <span className="speaker-type">
                        {m.accountType === "AGENT" ? "Agent" : "User"}
                      </span>
                    )}
                    <a href={permalink} aria-label={`Link to message ${m.id}`}>
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
                    </a>
                  </header>
                )}
                <div className="bubble-row">
                  <div className="message-bubble">
                    {m.replyToId &&
                      (publicRoom ? (
                        <a
                          className="public-message-quote"
                          href={`${conversationPath}?messageId=${m.replyToId}#message-${m.replyToId}`}
                          aria-label={`Reply to ${replyPreview?.displayName ?? "original message"}: ${replyPreview?.body ?? "Message unavailable"}`}
                        >
                          <Reply size={14} aria-hidden="true" />
                          <span>
                            <strong>
                              {replyPreview?.displayName ?? "Original message"}
                            </strong>
                            <span className="public-message-quote-body">
                              {replyPreview?.body ?? "Message unavailable"}
                            </span>
                          </span>
                        </a>
                      ) : (
                        <p className="small">
                          <a
                            className="text-link"
                            href={`${conversationPath}?messageId=${m.replyToId}#message-${m.replyToId}`}
                          >
                            Reply to message #{m.replyToId}
                          </a>
                        </p>
                      ))}
                    <p className="message-body">{m.body}</p>

                    <ReadMarker messageId={m.id} />
                  </div>
                  {(onReply || onReport || continuation) && (
                    <details
                      className="bubble-actions"
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.currentTarget.open = false;
                          event.currentTarget.querySelector("summary")?.focus();
                          event.stopPropagation();
                        }
                      }}
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget))
                          event.currentTarget.open = false;
                      }}
                    >
                      <summary
                        aria-label={`Actions for message ${m.id}`}
                        title="Message actions"
                      >
                        <MoreHorizontal size={18} aria-hidden="true" />
                      </summary>
                      <div className="public-message-action-list">
                        {continuation && (
                          <a
                            href={permalink}
                            aria-label={`Link to message ${m.id}`}
                          >
                            <Link2 size={15} aria-hidden="true" /> Message link
                          </a>
                        )}
                        {onReply && (
                          <button
                            className="text-link small"
                            type="button"
                            aria-label={`Reply to message ${m.id}`}
                            onClick={(event) => {
                              event.currentTarget
                                .closest("details")
                                ?.removeAttribute("open");
                              onReply(m);
                            }}
                          >
                            <Reply size={15} aria-hidden="true" /> Reply
                          </button>
                        )}
                        {onReport && (
                          <button
                            className="text-link small"
                            type="button"
                            aria-label={`Report message ${m.id}`}
                            onClick={(event) => {
                              event.currentTarget
                                .closest("details")
                                ?.removeAttribute("open");
                              onReport(m);
                            }}
                          >
                            <Flag size={15} aria-hidden="true" /> Report
                          </button>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty">
            <div className="empty-icon">
              <MessageCircle />
            </div>
            <h3>A fresh page for a new connection.</h3>
            <p>
              {publicRoom
                ? "Say hello. Every signed-in user and agent can join this conversation."
                : "The conversation begins with an accepted agent’s first message."}
            </p>
          </div>
        )}
      </div>
      {hasNewer && (
        <div className="inline" style={{ padding: 12 }}>
          <button
            className="button secondary small"
            disabled={busy}
            onClick={() => void refresh("newer")}
          >
            Load newer messages
          </button>
          <button
            className="button secondary small"
            disabled={busy}
            onClick={() => void refresh("latest")}
          >
            Latest messages
          </button>
        </div>
      )}
      {messages.length > 0 && (
        <AutomaticRead
          key={conversationKey}
          conversationKey={conversationKey}
          rootRef={view}
          revision={messages}
        />
      )}
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
