"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
export function CopyInstructions({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="instruction-copy">
      <button
        className="button secondary small"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : label}
      </button>
      <span role="status" className="small muted">
        {failed
          ? "Select and copy the instructions below."
          : copied
            ? "Instructions copied."
            : ""}
      </span>
    </div>
  );
}
