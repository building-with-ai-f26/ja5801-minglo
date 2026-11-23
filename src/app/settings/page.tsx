import { auth } from "@/auth";
import { AccountSignInSettings } from "@/components/account-signin-settings";
import { authRollout } from "@/lib/account-auth/config";
import { AppShell } from "@/components/app-shell";
import { TourSettings } from "@/components/tour-settings";
import { PageHead } from "@/components/ui";
import { RecoveryCodesForm } from "@/components/recovery-codes-form";
import { requireAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { AnalyticsPreference } from "@/components/analytics-preference";
import { analyticsIdentity } from "@/lib/analytics/preferences";
import { analyticsConfig } from "@/lib/analytics/config";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    verified?: string;
    authError?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const account = await requireAccount();
  const analytics = await analyticsIdentity(account.id);
  const unused = await db.recoveryCode.count({
    where: { accountId: account.id, usedAt: null },
  });
  return (
    <AppShell account={account} active="settings" title="Account settings">
      <PageHead
        title="Account settings"
        subtitle="Manage sign-in, recovery and your account preferences."
      />
      <div className="stack">
        {params.connected === "1" && (
          <p className="success" role="status">
            Google is connected to your account.
          </p>
        )}
        {params.verified === "1" && (
          <p className="success" role="status">
            Your recovery email is verified.
          </p>
        )}
        {params.authError && (
          <p className="error" role="alert">
            Google could not be connected. It may already belong to another
            account, or your confirmation expired. No accounts were merged. Try
            again below.
          </p>
        )}
        {account.type === "OWNER" && (
          <AccountSignInSettings
            accountId={account.id}
            recent={
              !!session?.authenticatedAt &&
              Date.now() - session.authenticatedAt < 600_000
            }
          />
        )}
        <TourSettings />
        <div className="card form-width">
          <AnalyticsPreference
            enabled={!!analytics}
            canEnable={account.type === "OWNER"}
            active={!!analyticsConfig()}
          />
        </div>
        <section className="card form-width" aria-label="Account recovery">
          <h2>Recovery codes</h2>
          <p>{unused} unused recovery codes.</p>
          <p>
            Generate codes after verifying your account and save them privately.
            Anyone with one of these codes can reset this account. Minglo stores
            only hashes and cannot show the codes again after you leave this
            page.
          </p>
          <p className="small muted">
            Using a code resets the password, signs out existing sessions and
            invalidates all remaining codes. Generate a fresh set after signing
            in again.
          </p>
          <RecoveryCodesForm
            recentHumanAuth={
              account.type === "OWNER" &&
              authRollout() !== "disabled" &&
              !!session?.authenticatedAt &&
              Date.now() - session.authenticatedAt < 600_000
            }
          />
        </section>
      </div>
    </AppShell>
  );
}
