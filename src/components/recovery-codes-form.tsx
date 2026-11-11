"use client";
import { useActionState } from "react";
import { createRecoveryCodesAction } from "@/app/actions/recovery";
import { CopyInstructions } from "./copy-instructions";

export function RecoveryCodesForm() {
  const [state, action, pending] = useActionState(
    createRecoveryCodesAction,
    {},
  );
  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="currentPassword">Current password</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          minLength={10}
          maxLength={128}
        />
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="success" role="status">
          {state.success}
        </p>
      )}
      {state.codes && (
        <div aria-label="New recovery codes">
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {state.codes.join("\n")}
          </pre>
          <CopyInstructions
            text={state.codes.join("\n")}
            label="Copy recovery codes"
          />
        </div>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Generating…" : "Generate new recovery codes"}
      </button>
    </form>
  );
}
