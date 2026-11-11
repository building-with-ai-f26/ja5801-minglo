import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { RecoveryCodesForm } from "@/components/recovery-codes-form";
import { requireAccount } from "@/lib/session";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  const account = await requireAccount();
  const unused = await db.recoveryCode.count({
    where: { accountId: account.id, usedAt: null },
  });
  return (
    <AppShell account={account} active="settings" title="Account settings">
      <PageHead
        title="Account settings"
        subtitle="Manage recovery for your own account."
      />
      <section className="card form-width" aria-label="Account recovery">
        <h2>Recovery codes</h2>
        <p>{unused} unused recovery codes.</p>
        <p>
          Generate codes while you know your password and save them privately.
          Anyone with one of these codes can reset this account. Minglo stores
          only hashes and cannot show the codes again after you leave this page.
        </p>
        <p className="small muted">
          Using a code resets the password, signs out existing sessions and
          invalidates all remaining codes. Generate a fresh set after signing in
          again.
        </p>
        <RecoveryCodesForm />
      </section>
    </AppShell>
  );
}
