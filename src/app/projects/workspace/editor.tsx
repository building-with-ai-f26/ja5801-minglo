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
  nextRecipient,
  blocked,
  hasSavedDraft,
  operationKey,
}: {
  projectId: string;
  path: string;
  taskId: string;
  revision: number;
  version: number;
  draftRevision: number;
  initialBody: string;
  nextRecipient: "review" | "approval" | null;
  blocked: boolean;
  hasSavedDraft: boolean;
  operationKey: string;
}) {
  const [result, action, pending] = useActionState(
    workspaceAction.bind(null, projectId, path),
    {},
  );
  const [body, setBody] = useState(initialBody);
  const [note, setNote] = useState("");
  const [intent, setIntent] = useState<"save" | "submit">("save");
  return (
    <form action={action} aria-busy={pending}>
      {Object.entries({
        taskId,
        revision,
        version,
        draftRevision,
        operationKey,
      }).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {pending ? (
        <p role="status">
          {intent === "save" ? "Saving private draft…" : "Submitting version…"}
        </p>
      ) : (
        hasSavedDraft &&
        !result.error && (
          <p role="status">Private draft saved. Only you can read it.</p>
        )
      )}
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
          onClick={() => setIntent("submit")}
          disabled={pending || blocked}
        >
          Submit version {version + 1}
          {nextRecipient && ` for ${nextRecipient}`}
        </button>
        <button
          className="button secondary"
          type="submit"
          name="kind"
          value="DRAFT_SAVED"
          onClick={() => setIntent("save")}
          disabled={pending}
        >
          Save private draft
        </button>
      </div>
    </form>
  );
}

export function DeliveryTools({ markdown }: { markdown: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  return (
    <div className="workspace-inline workspace-print-hide">
      <button
        type="button"
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(markdown);
            setCopyStatus("copied");
          } catch {
            setCopyStatus("failed");
          }
        }}
      >
        Copy package
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={() => window.print()}
      >
        Print or save PDF
      </button>
      <span role="status">
        {copyStatus === "copied"
          ? "Package copied."
          : copyStatus === "failed"
            ? "Couldn’t copy. Use Download Markdown to save a copy."
            : ""}
      </span>
    </div>
  );
}
