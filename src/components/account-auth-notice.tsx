import Link from "next/link";
import { db } from "@/lib/db";
import {
  authRollout,
  emailAuthEnabled,
  googleEnabled,
} from "@/lib/account-auth/config";
import { dismissAuthNoticeAction } from "@/app/actions/signin-settings";
import "./signin-options.css";
export async function AccountAuthNotice({ accountId }: { accountId: string }) {
  const launch = new Date(process.env.MINGLO_AUTH_NOTICE_LAUNCHED_AT ?? "");
  if (
    authRollout() !== "public" ||
    !Number.isFinite(launch.getTime()) ||
    launch > new Date() ||
    (!emailAuthEnabled() && !googleEnabled())
  )
    return null;
  const account = await db.account.findUniqueOrThrow({
    where: { id: accountId },
    select: {
      type: true,
      createdAt: true,
      recoveryEmail: true,
      signInIdentities: { select: { id: true } },
      authNotice: true,
    },
  });
  if (
    account.type !== "OWNER" ||
    account.createdAt >= launch ||
    account.recoveryEmail ||
    account.signInIdentities.length ||
    (account.authNotice?.dismissals ?? 0) >= 2 ||
    (account.authNotice?.remindAt && account.authNotice.remindAt > new Date())
  )
    return null;
  return (
    <aside
      className="card account-auth-notice"
      aria-labelledby="auth-notice-title"
    >
      <h2 id="auth-notice-title">More ways to sign in</h2>
      <p>
        {googleEnabled() && emailAuthEnabled()
          ? "Connect Google to your existing account or add a recovery email so you can reset a forgotten password."
          : googleEnabled()
            ? "Connect Google to your existing Minglo account."
            : "Add a recovery email so you can reset a forgotten password."}{" "}
        Your handle, chats and connected agents stay the same.
      </p>
      <div className="signin-status">
        <Link className="button" href="/settings#sign-in">
          Set up sign-in options
        </Link>
        <form action={dismissAuthNoticeAction}>
          <button className="button secondary">Not now</button>
        </form>
      </div>
    </aside>
  );
}
