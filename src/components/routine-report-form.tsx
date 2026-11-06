"use client";
import { startTransition, useActionState, useState } from "react";
import type { AgentRoutine } from "@prisma/client";
import { reportRoutineAction } from "@/app/actions/agent-routine";
import { ArrowRight } from "lucide-react";
export function RoutineReportForm({
  routine,
}: {
  routine?: Pick<
    AgentRoutine,
    "host" | "status" | "intervalMinutes" | "taskReference"
  > | null;
}) {
  // Submit explicitly so React does not reset the host/settings form after the action.
  const [result, submit, pending] = useActionState(reportRoutineAction, {});
  const [host, setHost] = useState(routine?.host ?? "OTHER");
  const [status, setStatus] = useState(
    routine?.status === "NEEDS_SETUP"
      ? "NEEDS_APPROVAL"
      : (routine?.status ?? "NEEDS_APPROVAL"),
  );
  const [interval, setIntervalValue] = useState(
    String(routine?.intervalMinutes ?? 5),
  );
  const [reference, setReference] = useState(routine?.taskReference ?? "");
  return (
    <form
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => submit(data));
      }}
    >
      <div className="field">
        <label htmlFor="host">Your agent host</label>
        <select
          id="host"
          name="host"
          value={host}
          onChange={(e) => setHost(e.target.value as typeof host)}
        >
          <option value="OTHER">Another host</option>
          <option value="MUSE">Muse</option>
          <option value="DOT">ChatGPT dot</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="routineStatus">Setup result</label>
        <select
          id="routineStatus"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="NEEDS_APPROVAL">Host approval needed</option>
          <option value="REPORTED_READY">Host confirmed the task</option>
          <option value="UNAVAILABLE">Host cannot run ongoing tasks</option>
          <option value="PAUSED">I stopped the task in my host</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="intervalMinutes">Actual check interval (minutes)</label>
        <input
          id="intervalMinutes"
          name="intervalMinutes"
          type="number"
          min={1}
          max={1440}
          value={interval}
          onChange={(e) => setIntervalValue(e.target.value)}
          required
        />
        <small>Suggested: 5 minutes. Use your host's supported interval.</small>
      </div>
      <div className="field">
        <label htmlFor="taskReference">Confirmed task name or ID</label>
        <input
          id="taskReference"
          name="taskReference"
          maxLength={200}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <small>
          Required when reporting a confirmed task. No passwords, keys, or claim
          links.
        </small>
      </div>
      {result.error && (
        <div className="error" role="alert">
          {result.error}
        </div>
      )}
      {result.success && (
        <div className="success" role="status">
          {result.success}
        </div>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Saving…" : "Save host setup report"}
        <ArrowRight size={15} />
      </button>
    </form>
  );
}
