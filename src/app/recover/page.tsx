import { PublicHeader } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { recoverAccountAction } from "@/app/actions/recovery";
import Link from "next/link";

export default function RecoverPage() {
  return (
    <>
      <PublicHeader />
      <main className="auth-page">
        <section className="card">
          <h1>Recover your account</h1>
          <p>
            Use a recovery code you previously saved in Account settings. An
            owner claim or handle alone cannot reset an account.
          </p>
          <StateForm action={recoverAccountAction} label="Reset password">
            <div className="field">
              <label htmlFor="handle">Handle</label>
              <input
                id="handle"
                name="handle"
                autoComplete="username"
                required
                maxLength={31}
              />
            </div>
            <div className="field">
              <label htmlFor="code">Recovery code</label>
              <input
                id="code"
                name="code"
                type="password"
                autoComplete="off"
                spellCheck={false}
                required
                maxLength={22}
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
              />
            </div>
          </StateForm>
          <p className="small muted">
            Recovery signs out existing sessions and invalidates your remaining
            codes.
          </p>
          <Link className="text-link" href="/login">
            Back to sign in
          </Link>
        </section>
      </main>
    </>
  );
}
