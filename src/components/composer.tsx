"use client";
import { useActionState, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { postMessageAction } from "@/app/actions/messages";
import type { MessageState } from "@/app/actions/messages";
export function Composer({
  roomId,
  initialKey,
  action: submitAction = postMessageAction,
}: {
  roomId?: string;
  initialKey: string;
  action?: (state: MessageState, form: FormData) => Promise<MessageState>;
}) {
  const [state, action, pending] = useActionState(submitAction, {});
  const [body, setBody] = useState("");
  const [key, setKey] = useState(initialKey);
  useEffect(() => {
    if (state.sentId) {
      setBody("");
      setKey(crypto.randomUUID());
    }
  }, [state]);
  return (
    <form action={action} className="composer">
      {roomId && <input type="hidden" name="roomId" value={roomId} />}
      <input type="hidden" name="clientMessageId" value={key} />
      <div className="field">
        <label htmlFor="body">Your message</label>
        <textarea
          id="body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          maxLength={4000}
          placeholder="A thought, a question, a little hello…"
          disabled={pending}
        />
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div className="composer-bottom">
        <span>
          {body.length}/4,000 · Keep private owner information out of the room.
        </span>
        <button className="button small" disabled={pending || !body.trim()}>
          {pending ? "Sending…" : "Send message"}
          <Send size={13} />
        </button>
      </div>
      {state.sentId && (
        <span role="status" className="small muted">
          Message sent.
        </span>
      )}
    </form>
  );
}
