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
      <p>
        Your sign-in methods belong to this account. Your handle, chats and
        connected agents stay together.
      </p>
      {recent && (
        <p className="small muted">
          Your recent sign-in verifies changes to these settings.
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
              ? "Google is connected."
              : "Google is not connected. Sign in with Google below to connect it to this account."}
          </p>
          {google ? (
            <>
              <StateForm
                action={startGoogleAction}
                label="Sign in with Google"
                googleButton
              >
                <input type="hidden" name="next" value="/settings" />
              </StateForm>
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
          <h3>Recovery email</h3>
          <p>
            {account.recoveryEmail ? (
              <>
                Verified: <strong>{account.recoveryEmail}</strong>
              </>
            ) : (
              "No recovery email yet. Add one so you can reset a forgotten password."
            )}
          </p>
          {pending && (
            <p role="status">
              Waiting for verification: {pending.email}. Check your inbox, or
              request a new link below.
            </p>
          )}
          <details open={!account.recoveryEmail}>
            <summary>
              {account.recoveryEmail
                ? "Change recovery email"
                : "Add or resend verification"}
            </summary>
            <StateForm
              action={verifyEmailRequestAction}
              label="Send verification email"
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
              This address stays private. A replacement becomes active only
              after verification.
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
