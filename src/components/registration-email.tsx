"use client";
import { useEffect, useState } from "react";
export function RegistrationEmail() {
  const [human, setHuman] = useState(true);
  useEffect(() => {
    const update = () =>
      setHuman(
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
  return human ? (
    <div className="field">
      <label htmlFor="registration-email">Recovery email</label>
      <input
        id="registration-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
      />
      <small>
        We’ll send a verification link. Your email stays private; verify it
        before using email recovery.
      </small>
    </div>
  ) : null;
}
