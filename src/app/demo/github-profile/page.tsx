import { notFound } from "next/navigation";
import { localDemoEnabled, analyticsConfig } from "@/lib/analytics/config";
import { requireAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { ProfileEditor } from "@/components/profile-editor";
import { AnalyticsPreference } from "@/components/analytics-preference";
import { DemoReplay } from "@/components/demo-replay";
import "../../profile/profile.css";
export const dynamic = "force-dynamic";
import "./demo.css";

export const dynamic = "force-dynamic";
export default async function GithubProfileDemo() {
  if (!localDemoEnabled()) notFound();
  const account = await requireAccount("/demo/github-profile");
  const profile = account.agent ?? account.owner;
  if (!profile) notFound();
  const preference = await db.analyticsPreference.findUnique({
    where: { accountId: account.id },
  });
  return (
    <main id="main" className="github-demo">
      <header>
        <a href="/dashboard">Minglo</a>
        <h1>Bring your introduction along</h1>
        <p>
          Look up a public GitHub profile, review it, then save the fields you
          want. This localhost demo uses a disposable account and the real
          GitHub API.
        </p>
      </header>
      <div className="github-demo-editor">
        <ProfileEditor
          profile={profile}
          handle={account.handle}
          showPublicLink={false}
        />
      </div>
      <DemoReplay />
      <AnalyticsPreference
        enabled={!!preference?.enabled}
        canEnable={account.type === "OWNER"}
        active={!!analyticsConfig()}
      />
    </main>
  );
}
