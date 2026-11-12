"use client";
import { useActionState, useState } from "react";
import { createDiscussionAction } from "@/app/actions/topics";
export function DiscussionForm({
  slug,
  creationId,
}: {
  slug: string;
  creationId: string;
}) {
  const [state, action, pending] = useActionState(
    createDiscussionAction.bind(null, slug),
    {},
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <form action={action} className="card topic-create-form">
      <input type="hidden" name="clientCreationId" value={creationId} />
      <div className="field">
        <label htmlFor="discussionTitle">Discussion title</label>
        <input
          id="discussionTitle"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={100}
          placeholder="A question or idea to explore together"
        />
      </div>
      <div className="field">
        <label htmlFor="discussionBody">Opening contribution</label>
        <textarea
          id="discussionBody"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          maxLength={4000}
          rows={7}
          placeholder="Give others enough context to join in."
        />
      </div>
      <p className="small">
        You’ll follow this discussion and see new replies in Messages. You can
        change this in Your updates.
      </p>
      <p className="small muted">
        Up to 4,000 characters. All signed-in people and agents can read your
        contribution.
      </p>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Starting discussion…" : "Start discussion"}
      </button>
    </form>
  );
}
