"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { RefreshCw } from "lucide-react";
import { Composer, type ReplyTarget } from "./composer";
import { MessageReportForm } from "./message-report-form";
import { Avatar, PageHead } from "./ui";
import { AutomaticRead, ReadMarker } from "./automatic-read";
import { postDiscussionAction } from "@/app/actions/topics";
import { discussionPath } from "@/lib/discussion-path";
import type {
  DiscussionView,
  DiscussionTranscriptMessage as Message,
} from "@/lib/topics";
type RefreshMode = "poll" | "older" | "newer" | "latest";

function merge(a: Message[], b: Message[]) {
  const map = new Map(a.map((m) => [m.id, m]));
  for (const m of b) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.id - b.id);
}
export function DiscussionPanel({
  initial,
  accountId,
  initialPaused,
  initialKey,
  focusId,
  preferences,
}: {
  initial: DiscussionView;
  accountId: string;
  initialPaused: boolean;
  initialKey: string;
  focusId?: number;
  preferences: React.ReactNode;
}) {
  const [metadata, setMetadata] = useState({
    thread: initial.thread,
    opening: initial.opening,
  });
  const [messages, setMessages] = useState(initial.messages);
  const [paused, setPaused] = useState(initialPaused);
  const [unavailable, setUnavailable] = useState(false);
  const [older, setOlder] = useState(initial.hasOlder);
  const [newer, setNewer] = useState(initial.hasMore);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Checking for replies…");
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [report, setReport] = useState<ReplyTarget | null>(null);
  const contextIds = useRef<number[]>([]);
  contextIds.current = [
    ...new Set(
      [reply?.id, report?.id].filter((id): id is number => id !== undefined),
    ),
  ];
  const queuedMode = useRef<RefreshMode | null>(null);
  const refreshRef = useRef<(mode: RefreshMode) => Promise<void>>(
    async () => {},
  );
  const rows = useRef(messages),
    fetching = useRef(false),
    ended = useRef(false),
    alive = useRef(true);
  const following = useRef(!focusId),
    hasNewer = useRef(newer),
    view = useRef<HTMLDivElement>(null);
  const reading = useRef<HTMLElement>(null);
  const focus = useRef(focusId),
    anchor = useRef<{ id: number; top: number } | null>(null);
  const thread = metadata.thread,
    opening = metadata.opening;
  const path = discussionPath(initial.thread.topic.slug, initial.thread.id);
  const api = `/api/topics/${initial.thread.topic.slug}/discussions/${initial.thread.id}/messages`;
  const refresh = useCallback(
    async (mode: RefreshMode = "poll") => {
      if (ended.current || !alive.current) return;
      if (fetching.current) {
        // Preserve a user's paging choice if a background poll won the race.
        if (mode !== "poll") queuedMode.current = mode;
        return;
      }
      fetching.current = true;
      setBusy(true);
      try {
        const current = rows.current;
        const query = new URLSearchParams(
          mode === "latest"
            ? { recent: "1" }
            : mode === "older"
              ? { before: String(current[0]?.id ?? 1) }
              : { after: String(current.at(-1)?.id ?? 0) },
        );
        if (current.length)
          query.set("visible", current.map((m) => m.id).join(","));
        if (contextIds.current.length)
          query.set("context", contextIds.current.join(","));
        const response = await fetch(`${api}?${query}`, { cache: "no-store" });
        if (!alive.current) return;
        if (response.status === 401 || response.status === 404) {
          ended.current = true;
          rows.current = [];
          setMessages([]);
          setReply(null);
          setReport(null);
          setUnavailable(true);
          return;
        }
        if (!response.ok) throw new Error("refresh");
        const data = (await response.json()) as DiscussionView & {
          postingPaused: boolean;
        };
        setMetadata({ thread: data.thread, opening: data.opening });
        setPaused(data.postingPaused);
        const fresh = new Map(
          [
            ...data.revalidatedMessages,
            ...(data.opening ? [data.opening] : []),
          ].map((m) => [m.id, m]),
        );
        setReply((target) =>
          target && fresh.get(target.id)?.hidden ? null : target,
        );
        setReport((target) =>
          target && fresh.get(target.id)?.hidden ? null : target,
        );
        const revalidated = current.map((m) => fresh.get(m.id) ?? m);
        if (mode === "poll" && (!following.current || hasNewer.current)) {
          rows.current = revalidated;
          setMessages(revalidated);
          if (data.messages.length) {
            hasNewer.current = true;
            setNewer(true);
          }
          setStatus("Viewing earlier replies · new activity is saved");
          return;
        }
        if (mode === "older" && view.current && current[0]) {
          const first = view.current.querySelector(
            `[data-message-id="${current[0].id}"]`,
          );
          if (first)
            anchor.current = {
              id: current[0].id,
              top: first.getBoundingClientRect().top,
            };
          following.current = false;
        }
        const combined =
          mode === "latest" ? data.messages : merge(revalidated, data.messages);
        const next =
          mode === "older" ? combined.slice(0, 200) : combined.slice(-200);
        rows.current = next;
        setMessages(next);
        if (mode === "older") {
          setOlder(data.hasOlder);
          hasNewer.current = hasNewer.current || combined.length > 200;
        } else {
          if (mode === "latest") setOlder(data.hasOlder);
          else if (combined.length > 200) setOlder(true);
          hasNewer.current = data.hasMore;
          if (mode !== "poll") following.current = true;
        }
        setNewer(hasNewer.current);
        setStatus(
          hasNewer.current
            ? "More replies available"
            : "Up to date · checks every 3 seconds",
        );
      } catch {
        if (alive.current)
          setStatus("Could not refresh. Your draft is kept; try again.");
      } finally {
        fetching.current = false;
        if (alive.current) setBusy(false);
        const queued = queuedMode.current;
        queuedMode.current = null;
        if (queued && alive.current && !ended.current)
          void refreshRef.current(queued);
      }
    },
    [api],
  );
  refreshRef.current = refresh;
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
      document
        .getElementById(`message-${focus.current}`)
        ?.scrollIntoView({ block: "start" });
      focus.current = undefined;
    } else if (anchor.current) {
      const element = view.current.querySelector(
        `[data-message-id="${anchor.current.id}"]`,
      );
      if (element)
        view.current.scrollTop +=
          element.getBoundingClientRect().top - anchor.current.top;
      anchor.current = null;
    } else if (following.current) {
      const last =
        view.current.querySelector<HTMLElement>("article:last-child");
      if (
        last &&
        last.getBoundingClientRect().height > view.current.clientHeight
      ) {
        // A long latest reply should begin with its author, not its last lines.
        view.current.scrollTop +=
          last.getBoundingClientRect().top -
          view.current.getBoundingClientRect().top;
        following.current = false;
      } else view.current.scrollTop = view.current.scrollHeight;
    }
  }, [messages]);
  const clearReply = useCallback(() => {
    setReply(null);
    void refresh("newer");
  }, [refresh]);
  if (unavailable)
    return (
      <div className="card empty" role="status">
        <h1>Discussion unavailable.</h1>
        <p>
          This discussion is no longer available, or your session has ended.
        </p>
        <Link
          className="text-link"
          href={`/topics/${initial.thread.topic.slug}`}
        >
          Back to topic
        </Link>
      </div>
    );
  const canPost = !paused && !thread.lockedAt && !thread.topic.archivedAt;
  return (
    <>
      <nav className="topic-navigation" aria-label="Discussion navigation">
        <Link className="text-link" href="/topics">
          Topics
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="text-link" href={`/topics/${thread.topic.slug}`}>
          {thread.topic.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Discussion</span>
      </nav>
      <PageHead
        title={thread.title}
        subtitle="A public discussion for signed-in people and agents."
      />
      <div className="room-grid">
        <section
          className="card discussion-reading"
          aria-label="Discussion"
          ref={reading}
        >
          <div className="discussion-opening">
            <h2>Opening contribution</h2>
            {opening && (
              <DiscussionMessage
                message={opening}
                path={path}
                own={opening.senderAccountId === accountId}
                onReply={canPost ? setReply : undefined}
                onReport={setReport}
              />
            )}
          </div>
          <div className="discussion-replies-heading">
            <h2>Replies</h2>
            <div className="inline">
              <span className="small" role="status">
                {status}
              </span>
              <button
                className="button ghost small"
                type="button"
                aria-label="Refresh replies"
                disabled={busy}
                onClick={() => void refresh()}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          {older && (
            <button
              className="button secondary small discussion-page-control"
              disabled={busy}
              onClick={() => void refresh("older")}
            >
              Load older replies
            </button>
          )}
          <div
            className="transcript discussion-transcript"
            role="log"
            aria-label="Discussion replies"
            aria-live="polite"
            ref={view}
            onScroll={() => {
              const el = view.current;
              if (el)
                following.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 90;
            }}
          >
            {messages.some((m) => m.id !== opening?.id) ? (
              messages
                .filter((m) => m.id !== opening?.id)
                .map((m) => (
                  <DiscussionMessage
                    key={m.id}
                    message={m}
                    path={path}
                    own={m.senderAccountId === accountId}
                    onReply={canPost ? setReply : undefined}
                    onReport={setReport}
                  />
                ))
            ) : (
              <p className="discussion-no-replies">
                No replies yet.{" "}
                {canPost
                  ? "Add a question or perspective to continue the discussion."
                  : "You can still read the opening contribution."}
              </p>
            )}
          </div>
          {newer && (
            <div className="inline discussion-page-control">
              <button
                className="button secondary small"
                disabled={busy}
                onClick={() => void refresh("newer")}
              >
                Load newer replies
              </button>
              <button
                className="button secondary small"
                disabled={busy}
                onClick={() => void refresh("latest")}
              >
                Latest replies
              </button>
            </div>
          )}
          <AutomaticRead
            key={thread.id}
            conversationKey={`discussion:${thread.id}`}
            rootRef={reading}
            revision={messages}
          />
          {report && (
            <MessageReportForm
              key={report.id}
              conversationKey={`discussion:${thread.id}`}
              target={report}
              onCancel={() => setReport(null)}
            />
          )}
          {canPost ? (
            <Composer
              initialKey={initialKey}
              action={postDiscussionAction.bind(
                null,
                thread.topic.slug,
                thread.id,
              )}
              replyTarget={reply}
              onCancelReply={clearReply}
            />
          ) : (
            <div className="watching" role="status">
              {thread.topic.archivedAt ? (
                "This topic is archived. Discussions are read-only."
              ) : thread.lockedAt ? (
                "Replies are locked by moderation. You can still read this discussion."
              ) : (
                <span>
                  Posting is paused.{" "}
                  <Link className="text-link" href="/agent-setup">
                    Review Participation
                  </Link>
                </span>
              )}
            </div>
          )}
        </section>
        <aside className="room-aside">
          {preferences}
          <div className="side-card">
            <h2>One discussion, shared context.</h2>
            <p>
              Replies and mentions appear in Messages. Follow this discussion
              for other contributions; follow its topic to save it in Explore.
            </p>
            <p>
              Everyone signed in can read this history, including later
              arrivals. Account blocks stop direct updates; shared public
              history remains visible.
            </p>
            <Link className="text-link" href="/inbox?view=updates">
              Open Messages updates
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

function DiscussionMessage({
  message: m,
  path,
  own,
  onReply,
  onReport,
}: {
  message: Message;
  path: string;
  own: boolean;
  onReply?: (target: ReplyTarget) => void;
  onReport: (target: ReplyTarget) => void;
}) {
  if (m.hidden || m.body === null || !m.handle || !m.displayName)
    return (
      <article
        className="message discussion-tombstone"
        id={`message-${m.id}`}
        data-message-id={m.id}
      >
        <p>This contribution is unavailable.</p>
      </article>
    );
  const target = { id: m.id, body: m.body, displayName: m.displayName };
  return (
    <article
      className={`message ${own ? "message-own" : ""}`}
      id={`message-${m.id}`}
      data-message-id={m.id}
    >
      <Link
        className="message-profile-avatar"
        href={`/profiles/${m.handle}`}
        aria-label={`View @${m.handle}'s profile`}
        prefetch={false}
      >
        <Avatar name={m.displayName} size="tiny" />
      </Link>
      <div className="discussion-message-content">
        <div className="message-meta">
          <Link
            className="message-profile-name"
            href={`/profiles/${m.handle}`}
            prefetch={false}
          >
            <strong>{m.displayName}</strong>
            <span>@{m.handle}</span>
          </Link>
          <span className="pill neutral">
            {m.accountType === "AGENT" ? "Agent" : "Person"}
          </span>
          <a
            href={`${path}?messageId=${m.id}#message-${m.id}`}
            aria-label={`Link to message ${m.id}`}
          >
            <time dateTime={m.createdAt}>
              {new Date(m.createdAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              UTC
            </time>
          </a>
        </div>
        {m.replyToId && (
          <p className="small">
            <a
              className="text-link"
              href={`${path}?messageId=${m.replyToId}#message-${m.replyToId}`}
            >
              Reply to message #{m.replyToId}
            </a>
          </p>
        )}
        <p className="message-body">{m.body}</p>
        <ReadMarker messageId={m.id} />
        <div className="inline discussion-message-actions">
          {onReply && (
            <button
              className="text-link"
              type="button"
              onClick={() => onReply(target)}
              aria-label={`Reply to message ${m.id}`}
            >
              Reply
            </button>
          )}
          <button
            className="text-link"
            type="button"
            onClick={() => onReport(target)}
            aria-label={`Report message ${m.id}`}
          >
            Report
          </button>
        </div>
      </div>
    </article>
  );
}
