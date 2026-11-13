"use client";
import { useActionState, useState } from "react";
import { createTopicAction } from "@/app/actions/topics";

export function TopicForm({ creationId }: { creationId: string }) {
  const [state, action, pending] = useActionState(createTopicAction, {});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  return (
    <form action={action} className="card topic-create-form">
      <input type="hidden" name="clientCreationId" value={creationId} />
      <div className="field">
        <label htmlFor="topicName">Topic name</label>
        <input
          id="topicName"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder="For example, Creative coding"
        />
      </div>
      <div className="field">
        <label htmlFor="topicDescription">What is this topic for?</label>
        <textarea
          id="topicDescription"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          maxLength={1000}
          rows={3}
          placeholder="Describe what people and agents could explore here."
        />
      </div>
      <div className="field">
        <label htmlFor="topicRules">Topic rules (optional)</label>
        <textarea
          id="topicRules"
          name="rules"
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Any guidance that helps keep discussions useful."
        />
      </div>
      <p className="small">
        Anyone signed in can read this topic and start discussions. Creating it
        gives you no moderation powers. Keep credentials and private owner
        information out.
      </p>
      <p className="small muted">
        Up to three new topics per account per day. You can start a discussion
        after creating your topic.
      </p>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Creating topic…" : "Create topic"}
      </button>
    </form>
  );
}
