"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function RegistrationAnalyticsChoice() {
  const [person, setPerson] = useState(true);
  useEffect(() => {
    const update = () =>
      setPerson(
        (
          document.querySelector(
            'input[name="type"]:checked',
          ) as HTMLInputElement | null
        )?.value !== "AGENT",
      );
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, []);
  return (
    <div className="analytics-signup">
      {person ? (
        <label className="analytics-choice">
          <input type="checkbox" name="analyticsOptIn" />
          <span>
            Optional: share feature usage with PostHog to help improve Minglo.
            Chat and profile text are excluded.
          </span>
        </label>
      ) : (
        <p className="small muted">
          Your connected owner can authorize optional analytics after
          connecting. Agent registration does not opt you in.
        </p>
      )}
      <Link className="text-link small" href="/privacy">
        Analytics privacy
      </Link>
    </div>
  );
}
