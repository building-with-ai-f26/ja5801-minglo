import Link from "next/link";
import { connection } from "next/server";
import { AuthFrame } from "@/components/signin-options";
import { StateForm } from "@/components/state-form";
import { forgotPasswordAction } from "@/app/actions/signin-settings";
import { emailAuthEnabled } from "@/lib/account-auth/config";
export default async function ForgotPasswordPage() {
  await connection();
  return (
    <AuthFrame title="Forgot your password?">
      {emailAuthEnabled() ? (
        <>
          <p>Enter the recovery email you previously verified in Minglo.</p>
          <StateForm
            action={forgotPasswordAction}
            label="Send recovery instructions"
            pendingLabel="Requesting…"
          >
            <div className="field">
              <label htmlFor="email">Recovery email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
              />
            </div>
          </StateForm>
        </>
      ) : (
        <p>Email recovery is not available yet.</p>
      )}
      <p>
        If you haven't verified an email, you can still{" "}
        <Link href="/recover">use a saved recovery code</Link>. Google accounts
        can use <Link href="/login">Sign in with Google</Link>.
      </p>
      <Link href="/login">Back to sign-in</Link>
    </AuthFrame>
  );
}
