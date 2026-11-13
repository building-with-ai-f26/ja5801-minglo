"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { markReadAction } from "@/app/actions/inbox";

export function ReadMarker({ messageId }: { messageId: number }) {
  return (
    <span
      data-read-message-id={messageId}
      aria-hidden="true"
      style={{ display: "block", width: 1, height: 1 }}
    />
  );
}

/** Observe the actual viewport, including clipping by nested transcript scrollers. */
export function AutomaticRead({
  conversationKey,
  rootRef,
  revision,
}: {
  conversationKey: string;
  rootRef: RefObject<HTMLElement | null>;
  revision: unknown;
}) {
  const through = useRef(0);
  const pending = useRef(false);
  const failed = useRef(false);
  const mounted = useRef(false);
  const reschedule = useRef<() => void>(() => {});
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const visible = new Set<number>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const active = () =>
      document.visibilityState === "visible" && document.hasFocus();
    const latestVisible = () => Math.max(0, ...visible);
    const clear = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const save = async () => {
      timer = undefined;
      const id = latestVisible();
      if (
        stopped ||
        !active() ||
        pending.current ||
        failed.current ||
        id <= through.current
      )
        return;
      pending.current = true;
      try {
        const form = new FormData();
        form.set("conversationKey", conversationKey);
        form.set("lastMessageId", String(id));
        const result = await markReadAction({}, form);
        if (result.error) throw new Error("read status");
        through.current = Math.max(through.current, id);
        if (mounted.current) setError(false);
      } catch {
        failed.current = true;
        if (mounted.current) setError(true);
      } finally {
        pending.current = false;
        // A poll may have replaced the observer while this request was pending.
        reschedule.current();
      }
    };
    const schedule = () => {
      clear();
      if (
        !stopped &&
        active() &&
        !pending.current &&
        !failed.current &&
        latestVisible() > through.current
      )
        timer = setTimeout(() => void save(), 800);
    };
    const resume = () => {
      failed.current = false;
      schedule();
    };
    reschedule.current = schedule;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = Number(
            (entry.target as HTMLElement).dataset.readMessageId,
          );
          if (entry.isIntersecting && entry.intersectionRatio === 1)
            visible.add(id);
          else visible.delete(id);
        }
        schedule();
      },
      { threshold: 1 },
    );
    for (const marker of root.querySelectorAll("[data-read-message-id]"))
      observer.observe(marker);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("focus", resume);
    window.addEventListener("blur", clear);
    window.addEventListener("online", resume);
    return () => {
      stopped = true;
      clear();
      observer.disconnect();
      reschedule.current = () => {};
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("focus", resume);
      window.removeEventListener("blur", clear);
      window.removeEventListener("online", resume);
    };
  }, [conversationKey, rootRef, revision, retry]);

  return error ? (
    <p className="small inline" role="status">
      Read status couldn’t be saved.
      <button
        className="text-link small"
        type="button"
        aria-label="Retry saving read status"
        onClick={() => {
          failed.current = false;
          setRetry((value) => value + 1);
        }}
      >
        Retry
      </button>
    </p>
  ) : null;
}
