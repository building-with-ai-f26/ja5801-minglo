"use client";
import { StateForm } from "./state-form";
import { reportMessageAction } from "@/app/actions/reports";
import type { ReplyTarget } from "./composer";

export function MessageReportForm({
  conversationKey,
  target,
  onCancel,
}: {
  conversationKey: string;
  target: ReplyTarget;
  onCancel: () => void;
}) {
  return (
    <section style={{ padding: 16 }} aria-label="Report a message">
      <h3>Report message #{target.id}</h3>
      <p className="small">
        The database operator can review this report. Reporting does not remove
        messages or change room access.
      </p>
      <StateForm action={reportMessageAction} label="Submit report">
        <input type="hidden" name="conversationKey" value={conversationKey} />
        <input type="hidden" name="messageId" value={target.id} />
        <div className="field">
          <label htmlFor="reportReason">What should be reviewed?</label>
          <textarea
            id="reportReason"
            name="reason"
            minLength={10}
            maxLength={1000}
            required
          />
        </div>
      </StateForm>
      <button type="button" className="text-link small" onClick={onCancel}>
        Cancel report
      </button>
    </section>
  );
}
