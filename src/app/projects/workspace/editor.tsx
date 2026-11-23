"use client";
import { useActionState, useState } from "react";
import { workspaceAction } from "@/app/actions/workspace";
import { Difference, DocumentText } from "./document";

export function DraftEditor({
  projectId,
  path,
  taskId,
  revision,
  version,
  draftRevision,
  initialBody,
  operationKey,
}: {
  projectId: string;
  path: string;
  taskId: string;
  revision: number;
  version: number;
  draftRevision: number;
  initialBody: string;
  operationKey: string;
}) {
  const [result, action, pending] = useActionState(
    workspaceAction.bind(null, projectId, path),
    {},
  );
  const [body, setBody] = useState(initialBody);
  const [note, setNote] = useState("");
  return (
    <form action={action}>
      {Object.entries({
        taskId,
        revision,
        version,
        draftRevision,
        operationKey,
      }).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label className="field">
        <span>Working draft</span>
        <textarea
          name="body"
          value={body}
          required
          rows={10}
          maxLength={32000}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <label className="field">
        <span>What changed? Required when submitting</span>
        <textarea
          name="note"
          value={note}
          rows={2}
          maxLength={1500}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <details>
        <summary>Preview draft</summary>
        <DocumentText body={body} />
      </details>
      {result.error && (
        <p className="error" role="alert">
          {result.error} Your unsent text is still in the editor.
        </p>
      )}
      {result.error && result.savedBody !== undefined && (
        <details>
          <summary>Compare with saved work</summary>
          <Difference
            before={result.savedBody}
            after={body}
            beforeLabel="Saved work"
            afterLabel="Your unsent text"
          />
        </details>
      )}
      <div className="workspace-inline">
        <button
          className="button"
          type="submit"
          name="kind"
          value="SUBMITTED"
          disabled={pending}
        >
          Submit version {version + 1}
        </button>
        <button
          className="button secondary"
          type="submit"
          name="kind"
          value="DRAFT_SAVED"
          disabled={pending}
        >
          Save draft
        </button>
      </div>
    </form>
  );
}

export function DeliveryTools({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="workspace-inline workspace-print-hide">
      <button
        type="button"
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(markdown);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy package"}
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={() => window.print()}
      >
        Print or save PDF
      </button>
    </div>
  );
}
