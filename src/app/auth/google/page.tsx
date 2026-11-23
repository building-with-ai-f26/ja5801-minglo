import Link from "next/link";
import { cookies } from "next/headers";
import { AuthFrame, CurrentPassword } from "@/components/signin-options";
import { StateForm } from "@/components/state-form";
import { currentAccount } from "@/lib/session";
import { AUTH_COOKIE } from "@/lib/account-auth/config";
import { readAuthToken } from "@/lib/account-auth/service";
import {
  completeGoogleSignupAction,
  connectPendingGoogleAction,
} from "@/app/actions/signin-settings";
export default async function GoogleAccountPage() {
  const proof = await readAuthToken(
    (await cookies()).get(AUTH_COOKIE)?.value ?? "",
    "google-profile",
  );
  const account = await currentAccount();
  return (
    <AuthFrame title="Keep your Minglo account together">
      {!proof ? (
        <p>
          Your Google confirmation expired.{" "}
          <Link href="/login">Start sign-in again</Link>.
        </p>
      ) : (
        <>
          <p>
            Google confirmed <strong>{proof.email}</strong>.
          </p>
          {account ? (
            account.type === "OWNER" ? (
              <>
                <p>
                  Connect Google to <strong>@{account.handle}</strong>. Your
                  existing chats and agent connections stay here.
                </p>
                <StateForm
                  action={connectPendingGoogleAction}
                  label={`Connect Google to @${account.handle}`}
                >
                  <CurrentPassword id="connect-password" />
                </StateForm>
              </>
            ) : (
              <p>
                Google sign-in is for human accounts. Your agent uses its
                existing password and recovery codes.
              </p>
            )
          ) : (
            <>
              <p>
                Already use Minglo? Sign in to your existing account before
                connecting Google.
              </p>
              <Link className="button" href="/login?next=%2Fauth%2Fgoogle">
                Connect an existing account
              </Link>
              {process.env.MINGLO_GOOGLE_SIGNUP_ENABLED === "true" && (
                <details>
                  <summary>I'm new to Minglo — create an account</summary>
                  <StateForm
                    action={completeGoogleSignupAction}
                    label="Create my Minglo account"
                  >
                    <input type="hidden" name="newAccount" value="yes" />
                    <div className="field">
                      <label htmlFor="displayName">Display name</label>
                      <input
                        id="displayName"
                        name="displayName"
                        required
                        maxLength={60}
                        autoComplete="nickname"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="handle">Handle</label>
                      <input
                        id="handle"
                        name="handle"
                        required
                        minLength={3}
                        maxLength={30}
                        autoCapitalize="none"
                        autoComplete="username"
                        pattern="[A-Za-z0-9_]{3,30}"
                      />
                      <small>3–30 letters, numbers or underscores.</small>
                    </div>
                    <p className="small">
                      Your Google email becomes your private verified recovery
                      address. No Minglo password is required. Optional
                      analytics starts off.{" "}
                      <Link href="/privacy">Privacy information</Link>
                    </p>
                  </StateForm>
                </details>
              )}
            </>
          )}
        </>
      )}
    </AuthFrame>
  );
}
