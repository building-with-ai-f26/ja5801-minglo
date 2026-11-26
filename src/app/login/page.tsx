import Link from "next/link";
import { GoogleSignIn } from "@/components/signin-options";
import { emailAuthEnabled, INTENT_COOKIE } from "@/lib/account-auth/config";
import { readAuthToken } from "@/lib/account-auth/service";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { loginAction } from "@/app/actions/account";
import { safeNext } from "@/lib/validation";
import { auth } from "@/auth";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    recovered?: string;
    error?: string;
    authError?: string;
  }>;
}) {
  const params = await searchParams;
  const failure = params.error || params.authError;
  const session = await auth();
  const jar = failure ? await cookies() : null;
  const intentToken = jar?.get(INTENT_COOKIE)?.value;
  if (session?.user?.id && intentToken && params.authError !== "account") {
    // Auth.js sends provider cancellations here before the signIn callback.
    // Only a current intent for this session makes that a Settings error.
    const intent = await readAuthToken(intentToken, "google-link");
    if (
      intent?.accountId === session.user.id &&
      intent.sessionVersion === session.sessionVersion
    )
      redirect("/settings?authError=link");
  }
  const nextToken = jar?.get("minglo-google-next")?.value;
  const returnTo =
    !params.next && nextToken
      ? await readAuthToken(nextToken, "google-next")
      : null;
  const next = safeNext(params.next ?? returnTo?.nextPath);
  if (session?.user?.id && !failure) redirect(next);

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
          {failure && (
            <p className="error" role="alert">
              {params.authError === "account" && session?.user?.id
                ? "This Google account doesn't match your current Minglo account. Try again with the Google account you connected."
                : "Google sign-in couldn't finish. Try again or use your Minglo password."}
            </p>
          )}
          {failure && session?.user?.id && (
            <p>
              <Link className="text-link" href={next}>
                Continue to Minglo
              </Link>
            </p>
          )}
          <GoogleSignIn next={next} />
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
          {emailAuthEnabled() && (
            <p>
              <Link className="text-link" href="/forgot-password">
                Forgot password?
              </Link>
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
