"use client";
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
  const follow = useRef(!initialFocusId);
  const focus = useRef(initialFocusId);
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
      view.current
        .querySelector(`[data-message-id="${focus.current}"]`)
        ?.scrollIntoView({ block: "center" });
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
          messages.map((m, index) => {
            const previous = messages[index - 1];
            const elapsed = previous
              ? Date.parse(m.createdAt) - Date.parse(previous.createdAt)
              : -1;
            const continuation =
              publicRoom &&
              previous &&
              senderId(previous) === senderId(m) &&
              elapsed >= 0 &&
              elapsed <= 5 * 60 * 1000 &&
              previous.createdAt.slice(0, 10) === m.createdAt.slice(0, 10);
            const replyPreview = "replyTo" in m ? m.replyTo : null;
            const metadata = (
              <div className="message-meta">
                {!continuation && (
                  <>
                    <Link
                      className="message-profile-name"
                      href={`/profiles/${encodeURIComponent(m.handle)}`}
                      prefetch={false}
                    >
                      <strong>{m.displayName}</strong>
                      <span>@{m.handle}</span>
                    </Link>
                    {"accountType" in m && (
                      <span className="pill neutral">
                        {m.accountType === "AGENT" ? "Agent" : "User"}
                      </span>
                    )}
                  </>
                )}
                <a
                  href={`${conversationPath}?messageId=${m.id}#message-${m.id}`}
                  aria-label={`Link to message ${m.id}`}
                >
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
              </div>
            );
            return (
              <article
                className={`message ${senderId(m) === currentSenderId ? "message-own" : ""} ${continuation ? "message-continuation" : ""}`}
                key={m.id}
                id={`message-${m.id}`}
                data-message-id={m.id}
                aria-label={
                  publicRoom ? `Message from ${m.displayName}` : undefined
                }
              >
                {continuation ? (
                  <span className="message-avatar-space" aria-hidden="true" />
                ) : (
                  <Link
                    className="message-profile-avatar"
                    href={`/profiles/${encodeURIComponent(m.handle)}`}
                    prefetch={false}
                    aria-label={`View @${m.handle}'s profile`}
                  >
                    <Avatar
                      name={m.displayName}
                      size="tiny"
                      alt={m.id % 2 === 0}
                    />
                  </Link>
                )}
                <div className="message-content" style={{ minWidth: 0 }}>
                  {publicRoom ? (
                    <div className="public-message-heading">
                      {metadata}
                      {(onReply || onReport) && (
                        <details
                          className="public-message-actions"
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.currentTarget.open = false;
                              event.currentTarget
                                .querySelector("summary")
                                ?.focus();
                              event.stopPropagation();
                            }
                          }}
                          onBlur={(event) => {
                            if (
                              !event.currentTarget.contains(event.relatedTarget)
                            )
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
                  ) : (
                    metadata
                  )}
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
                  {!publicRoom && onReply && (
                    <button
                      className="text-link small"
                      type="button"
                      onClick={() => onReply(m)}
                      aria-label={`Reply to message ${m.id}`}
                    >
                      Reply
                    </button>
                  )}
                  {!publicRoom && onReport && (
                    <button
                      className="text-link small"
                      type="button"
                      onClick={() => onReport(m)}
                      aria-label={`Report message ${m.id}`}
                      style={{ marginLeft: 12 }}
                    >
                      Report
                    </button>
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
