"use client";
import { useId, useRef, useState } from "react";
import { importGithubProfileAction } from "@/app/actions/github-profile";
import type { GithubProfile } from "@/lib/github-profile";

export function GithubProfileImport() {
  const id = useId();
  const root = useRef<HTMLDetailsElement>(null);
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<GithubProfile | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  async function lookup() {
    if (pending) return;
    setPending(true);
    setProfile(null);
    setError("");
    setStatus("");
    try {
      const result = await importGithubProfileAction(username);
      if (result.error) setError(result.error);
      else if (result.profile) setProfile(result.profile);
    } catch {
      setError(
        "The lookup did not finish. Your draft is unchanged. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  function apply() {
    const form = root.current?.closest("form");
    if (!profile || !form) return;
    for (const [name, value] of [
      ["displayName", profile.displayName],
      ["bio", profile.bio],
    ]) {
      const field = form.elements.namedItem(name);
      // An empty GitHub bio must not erase an existing introduction.
      if (
        value &&
        (field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement)
      ) {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    setStatus(
      "Added to your draft. Review the fields, then choose Save profile.",
    );
  }
  return (
    <details ref={root} className="github-profile-import">
      <summary>
        Import from GitHub <span className="muted small">Optional</span>
      </summary>
      <p className="small muted">
        Look up a public name and bio. The username you enter is sent to GitHub.
        No password or GitHub connection is needed; this does not verify
        ownership.
      </p>
      <div className="field">
        <label htmlFor={id}>Public GitHub username</label>
        <input
          id={id}
          value={username}
          maxLength={39}
          autoCapitalize="none"
          spellCheck={false}
          disabled={pending}
          onChange={(event) => {
            setUsername(event.target.value);
            setProfile(null);
            setStatus("");
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void lookup();
            }
          }}
        />
      </div>
      <button
        type="button"
        className="button secondary"
        disabled={pending || !username.trim()}
        onClick={lookup}
        data-analytics-action="github_profile_lookup"
      >
        {pending ? "Looking up…" : "Preview GitHub profile"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {profile && (
        <section
          className="github-profile-preview"
          aria-label="GitHub profile preview"
        >
          <h3>Preview from GitHub</h3>
          <p className="small muted">Public profile: @{profile.username}</p>
          <p>
            <strong>{profile.displayName}</strong>
          </p>
          <p>
            {profile.bio ||
              "No public bio. Your current introduction will be kept."}
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={apply}
            data-analytics-action="github_profile_apply"
          >
            Use in my draft
          </button>
        </section>
      )}
      <p role="status" className="small muted">
        {status}
      </p>
    </details>
  );
}
