import { db } from "@/lib/db";
import {
  authRollout,
  emailAuthEnabled,
  googleEnabled,
} from "@/lib/account-auth/config";
import { StateForm } from "./state-form";
import { CurrentPassword, NewPasswordFields } from "./signin-options";
import {
  disconnectGoogleAction,
  setPasswordAction,
  startGoogleAction,
  verifyEmailRequestAction,
} from "@/app/actions/signin-settings";
export async function AccountSignInSettings({
  accountId,
  recent,
}: {
  accountId: string;
  recent: boolean;
}) {
  if (authRollout() === "disabled") return null;
  const account = await db.account.findUniqueOrThrow({
    where: { id: accountId },
    select: {
      recoveryEmail: true,
      passwordHash: true,
      signInIdentities: { select: { provider: true } },
    },
  });
  const pending = await db.accountAuthToken.findFirst({
    where: {
      accountId,
      purpose: "verify-email",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { email: true },
  });
  const google = account.signInIdentities.some(
    (identity) => identity.provider === "google",
  );
  return (
    <section
      className="card form-width auth-settings"
      id="sign-in"
      aria-labelledby="signin-title"
    >
      <h2 id="signin-title">Sign-in and recovery</h2>
      {pending ? (
        <p>
          <strong>Check your email to finish.</strong> Open the verification
          link sent to {pending.email}.
        </p>
      ) : account.recoveryEmail ? (
        <p>
          <strong>You're all set.</strong> Your recovery email is verified. No
          further setup is needed.
        </p>
      ) : google ? (
        <p>
          <strong>Google sign-in is ready.</strong> Finish recovery setup below
          so you can also reset your Minglo password by email.
        </p>
      ) : (
        <p>
          Connect Google to set up sign-in and recovery together, or add an
          email address for password resets.
        </p>
      )}
      {authRollout() === "trial" && (
        <p className="small muted">
          Google and email recovery are being tested with invited accounts.
        </p>
      )}
      {googleEnabled() && (
        <>
          <h3>Google</h3>
          <p>
            {google
              ? "Connected. You can use Google to sign in to this account."
              : account.recoveryEmail
                ? "Connect Google for another way to sign in. Your current recovery email will stay the same."
                : pending
                  ? "You can also connect Google to sign in. Finish verifying the email you already requested below."
                  : "Connect your Google account below. We'll use its verified email for recovery, with no extra email verification step."}
          </p>
          {google ? (
            <>
              {!account.recoveryEmail && !pending && (
                <p>
                  Sign in with Google once more to finish recovery setup. If its
                  email is already used by another Minglo account, choose a
                  different recovery email below.
                </p>
              )}
              {(!recent || (!account.recoveryEmail && !pending)) && (
                <StateForm
                  action={startGoogleAction}
                  label="Sign in with Google"
                  googleButton
                >
                  <input type="hidden" name="next" value="/settings" />
                </StateForm>
              )}
              <details>
                <summary>Disconnect Google</summary>
                <p>
                  Keep a Minglo password before disconnecting. This signs out
                  existing sessions.
                </p>
                <StateForm
                  action={disconnectGoogleAction}
                  label="Disconnect Google"
                >
                  <CurrentPassword
                    recent={recent}
                    passwordAvailable={!!account.passwordHash}
                    id="unlink-password"
                  />
                </StateForm>
              </details>
            </>
          ) : (
            <StateForm
              action={startGoogleAction}
              label="Sign in with Google"
              googleButton
              pendingLabel="Opening Google…"
            >
              <input type="hidden" name="link" value="yes" />
              <input type="hidden" name="next" value="/settings" />
              <CurrentPassword
                recent={recent}
                passwordAvailable={!!account.passwordHash}
                id="link-password"
              />
            </StateForm>
          )}
        </>
      )}
      {emailAuthEnabled() && (
        <>
          <h3>Password recovery</h3>
          <p>
            {account.recoveryEmail ? (
              <>
                Password reset emails go to{" "}
                <strong>{account.recoveryEmail}</strong>. This address is
                verified; you don't need a verification email.
              </>
            ) : pending ? (
              "Your address is not verified yet."
            ) : (
              "No email verification is in progress. To use an email address instead of Google's verified address, enter it below and send a verification link."
            )}
          </p>
          {pending && (
            <p role="status">
              Email sent to {pending.email}. Look for “Verify your Minglo
              recovery email” in your inbox or spam folder. The link expires
              after 30 minutes. Use the latest email if you resend it.
            </p>
          )}
          <details open={!!pending || (!account.recoveryEmail && !google)}>
            <summary>
              {account.recoveryEmail
                ? "Change recovery email"
                : pending
                  ? "Resend or change email"
                  : google
                    ? "Use a different recovery email"
                    : "Add a recovery email"}
            </summary>
            <StateForm
              action={verifyEmailRequestAction}
              label={
                pending
                  ? "Resend verification email"
                  : "Send verification email"
              }
              pendingLabel="Sending…"
            >
              <div className="field">
                <label htmlFor="recovery-email">Recovery email</label>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  defaultValue={pending?.email ?? ""}
                />
              </div>
              <CurrentPassword
                recent={recent}
                passwordAvailable={!!account.passwordHash}
                id="email-password"
              />
            </StateForm>
            <p className="small muted">
              Click the button to send a link, then open that email and confirm.
              Your address stays private. An existing recovery address stays
              active until you verify its replacement.
            </p>
          </details>
        </>
      )}
      <h3>Password</h3>
      <p>
        {account.passwordHash
          ? "You can sign in with your handle and password."
          : "You use Google sign-in. A Minglo password is optional."}
      </p>
      <details>
        <summary>
          {account.passwordHash ? "Change password" : "Set a password"}
        </summary>
        <p>
          Changing your password signs out all sessions and invalidates saved
          recovery codes.
        </p>
        <StateForm action={setPasswordAction} label="Save password">
          <CurrentPassword
            recent={recent}
            passwordAvailable={!!account.passwordHash}
            id="set-password-current"
          />
          <NewPasswordFields />
        </StateForm>
      </details>
    </section>
  );
}
