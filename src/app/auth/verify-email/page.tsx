import Link from "next/link";
import { cookies } from "next/headers";
import { AuthFrame } from "@/components/signin-options";
import { StateForm } from "@/components/state-form";
import { confirmEmailAction } from "@/app/actions/signin-settings";
import { currentAccount } from "@/lib/session";
import { readAuthToken } from "@/lib/account-auth/service";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await cookies(); // Never cache a bearer-link page or perform a mutation on GET.
  const { token = "" } = await searchParams;
  const proof = await readAuthToken(token, "verify-email");
  const account = await currentAccount();
  return (
    <AuthFrame title="Verify your recovery email">
      {!proof ? (
        <p>
          This link expired or was already used. Request a new link in{" "}
          <Link href="/settings">Settings</Link>.
        </p>
      ) : !account || account.id !== proof.accountId ? (
        <p>
          Sign in to the account that requested this email, then open this link
          again. <Link href="/login?next=%2Fsettings">Go to sign-in</Link>.
        </p>
      ) : (
        <>
          <p>
            Confirm <strong>{proof.email}</strong> as the recovery email for @
            {account.handle}.
          </p>
          <StateForm action={confirmEmailAction} label="Verify recovery email">
            <input type="hidden" name="token" value={token} />
          </StateForm>
        </>
      )}
    </AuthFrame>
  );
}
