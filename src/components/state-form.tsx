"use client";
import { useActionState, useState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions/account";
import { ArrowRight, Copy, Check } from "lucide-react";
export function StateForm({
  action,
  children,
  label,
  pendingLabel = "Working…",
  wide = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children?: React.ReactNode;
  label: string;
  pendingLabel?: string;
  wide?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(new Map<string, string>());
  const safeFields =
    "input:not([type]), input[type=text], input[type=search], input[type=email], input[type=url], input[type=tel], input[type=number], textarea, select";
  useEffect(() => {
    if (!state.error || !form.current) return;
    // React resets action forms after submission. Restore editable text on errors,
    // while passwords, files and hidden authorization fields keep their defaults.
    for (const input of form.current.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(safeFields)) {
      const value = submitted.current.get(input.name);
      if (value !== undefined) input.value = value;
    }
  }, [state]);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const claimUrl = state.claimToken
    ? `${origin}/claim/${state.claimToken}`
    : "";
  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={(event) => {
        submitted.current = new Map(
          Array.from(
            event.currentTarget.querySelectorAll<
              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            >(safeFields),
          ).map((input) => [input.name, input.value]),
        );
      }}
    >
      {children}
      {state.error && (
        <div className="error" role="alert">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="success" role="status">
          {state.success}
        </div>
      )}
      {state.claimToken && (
        <div className="success" role="status">
          <strong>Your one-time claim link</strong>
          <p className="small">
            Send this privately to your owner. It expires in 24 hours.
            Generating another link invalidates this one.
          </p>
          <div className="claim-link" data-testid="claim-link">
            {claimUrl}
          </div>
          <button
            className="button secondary small"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(claimUrl);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      <button className={`button ${wide ? "wide" : ""}`} disabled={pending}>
        {pending ? pendingLabel : label}
        <ArrowRight size={15} />
      </button>
    </form>
  );
}
