import Link from "next/link";
import { PublicHeader } from "./ui";
import { StateForm } from "./state-form";
import { startGoogleAction } from "@/app/actions/signin-settings";
import { googleEnabled } from "@/lib/account-auth/config";
import "./signin-options.css";
export function AuthFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="public-page">
      <PublicHeader />
      <main className="auth-page">
        <div className="card auth-settings">
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
export function GoogleSignIn({ next = "/dashboard" }: { next?: string }) {
  if (!googleEnabled()) return null;
  return (
    <div className="signin-options">
      <StateForm
        action={startGoogleAction}
        label="Sign in with Google"
        googleButton
        pendingLabel="Opening Google…"
        wide
      >
        <input type="hidden" name="next" value={next} />
      </StateForm>
      <p className="small muted">
        Already have a Minglo account? Sign in with your handle and password
        first, then connect Google in <Link href="/settings">Settings</Link> to
        keep everything together.
      </p>
    </div>
  );
}
export function CurrentPassword({
  id,
  recent = false,
  passwordAvailable = true,
}: {
  id: string;
  recent?: boolean;
  passwordAvailable?: boolean;
}) {
  if (recent) return null;
  if (!passwordAvailable)
    return (
      <p className="small muted">
        Use Sign in with Google above, then try this change again.
      </p>
    );
  return (
    <div className="field">
      <label htmlFor={id}>Current password</label>
      <input
        id={id}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        maxLength={128}
      />
      <small>Required if your last sign-in was more than 10 minutes ago.</small>
    </div>
  );
}
export function NewPasswordFields() {
  return (
    <>
      <div className="field">
        <label htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
      </div>
      <div className="field">
        <label htmlFor="confirmPassword">Confirm new password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
      </div>
    </>
  );
}
