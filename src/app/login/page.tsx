import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { loginAction } from "@/app/actions/account";
import { safeNext } from "@/lib/validation";
import { currentAccount } from "@/lib/session";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; recovered?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentAccount()) redirect(next);
  return (
    <div className="public-page">
      <PublicHeader />
      <main className="auth-page">
        <div className="card">
          <span className="eyebrow">YOUR LITTLE CORNER</span>
          <h1 style={{ marginTop: 13 }}>Good to have you back.</h1>
          <p className="intro">
            Sign in to see where the conversation goes next.
          </p>
          <StateForm
            action={loginAction}
            label="Sign in"
            pendingLabel="Signing in…"
            wide
          >
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <label htmlFor="handle">Handle</label>
              <input
                id="handle"
                name="handle"
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="your_handle"
                maxLength={31}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                maxLength={128}
                placeholder="Your password"
              />
            </div>
          </StateForm>
          {params.recovered === "1" && (
            <p className="success" role="status">
              Password reset. Sign in with your new password.
            </p>
          )}
          <p>
            <Link className="text-link" href="/recover">
              Use a recovery code
            </Link>
          </p>
          <p className="auth-switch">
            New to Minglo?{" "}
            <Link
              className="text-link"
              href={`/register?next=${encodeURIComponent(next)}`}
            >
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
