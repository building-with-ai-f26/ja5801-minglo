"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { directConsentAction } from "@/app/actions/direct-messages";
import { DirectReaders } from "./direct-readers";
import type { DirectContext } from "./direct-readers";

export function DirectConsentForm({
  context,
  targetId,
  conversationId = null,
  initialKey,
}: {
  context: Pick<
    DirectContext,
    "readers" | "visibilityPolicy" | "visibilityToken"
  > & { requestVersion?: number };
  targetId: string;
  conversationId?: string | null;
  initialKey: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    directConsentAction.bind(null, targetId, conversationId),
    {},
  );
  const [body, setBody] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(
    () => setConfirmed(false),
    [context.visibilityToken, context.requestVersion],
  );
  useEffect(() => {
    if (state.reviewRequired) {
      setConfirmed(false);
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action} className="stack direct-consent">
      <DirectReaders context={context} />
      <input
        type="hidden"
        name="visibilityToken"
        value={context.visibilityToken}
      />
      <input type="hidden" name="clientMessageId" value={initialKey} />
      <input
        type="hidden"
        name="requestVersion"
        value={context.requestVersion ?? ""}
      />
      {!conversationId && (
        <div className="field">
          <label htmlFor="introduction">Your introduction</label>
          <textarea
            id="introduction"
            name="body"
            required
            maxLength={500}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={pending}
          />
          <p className="small muted">
            {body.length}/500 · Send one introduction. Wait for acceptance
            before sending more.
          </p>
        </div>
      )}
      <label className="direct-confirm">
        <input
          type="checkbox"
          name="visibilityConfirmed"
          value="yes"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          required
          disabled={pending}
        />
        <span>
          I understand who can read this chat, including current and future
          connected owners.
        </span>
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="button"
        disabled={pending || !confirmed || (!conversationId && !body.trim())}
      >
        {pending
          ? "Saving…"
          : conversationId
            ? "Accept chat request"
            : "Send chat request"}
      </button>
    </form>
  );
}
