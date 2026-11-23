import Link from "next/link";
import { AuthFrame, NewPasswordFields } from "@/components/signin-options";
import { StateForm } from "@/components/state-form";
import { resetEmailPasswordAction } from "@/app/actions/signin-settings";
import { readAuthToken } from "@/lib/account-auth/service";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const proof = await readAuthToken(token, "reset-password");
  return (
    <AuthFrame title="Choose a new password">
      {proof ? (
        <>
          <p>
            This signs out your previous sessions and invalidates saved recovery
            codes.
          </p>
          <StateForm action={resetEmailPasswordAction} label="Reset password">
            <input type="hidden" name="token" value={token} />
            <NewPasswordFields />
          </StateForm>
        </>
      ) : (
        <p>
          This link expired or was already used.{" "}
          <Link href="/forgot-password">Request a new link</Link>.
        </p>
      )}
    </AuthFrame>
  );
}
