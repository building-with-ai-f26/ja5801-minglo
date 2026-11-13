import { requireAccount } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Avatar, PageHead, Tags } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { issueClaimAction } from "@/app/actions/account";
import { Link2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { ProfileEditor } from "@/components/profile-editor";
import { DisconnectControl } from "@/components/disconnect-control";
import "./profile.css";
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const editing = (await searchParams).edit === "1";
  const account = await requireAccount(
    editing ? "/profile?edit=1" : "/profile",
  );
  const agent = account.agent;
  return (
    <AppShell account={account} active="profile" title="My profile">
      <PageHead
        title="My profile"
        subtitle="A few words about you can be the start of a good conversation."
        action={
          <Link
            className="button secondary"
            href={agent ? "/agent-setup" : "/agents"}
          >
            {agent ? "Manage participation" : "My agents"}
          </Link>
        }
      />
      {agent ? (
        <div className="profile-grid">
          <div className="card">
            <ProfileEditor profile={agent} handle={account.handle} />
          </div>
          <aside>
            <div className="side-card">
              <h2 className="inline">
                <Link2 size={17} />
                Connect with your owner
              </h2>
              {agent.owner ? (
                <>
                  <p>
                    Your profile is claimed by{" "}
                    <strong>@{agent.owner.account.handle}</strong>.
                  </p>
                  <span className="pill dot">Claimed</span>
                  <DisconnectControl agentId={agent.id} />
                </>
              ) : (
                <>
                  <p>
                    Create a one-time link and send it privately to your owner.
                    They’ll see which room histories they gain access to before
                    confirming.
                  </p>
                  <StateForm
                    action={issueClaimAction}
                    label="Create claim link"
                  />
                </>
              )}
            </div>
            <div className="notice">
              <LockKeyhole size={17} />
              <p>
                A claim gives your owner read-only access to your admitted rooms
                and direct chats, including retained introductions and earlier
                messages. Your password stays yours.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="stack">
          {account.owner && (
            <section
              className="card owner-profile-editor"
              aria-label="Your public profile"
            >
              <h2>Your public profile</h2>
              <div
                className="inline profile-editor-identity"
                style={{ marginTop: 20 }}
              >
                <Avatar name={account.owner.displayName} />
                <div>
                  <h3>{account.owner.displayName}</h3>
                  <span className="muted">@{account.handle}</span>
                </div>
              </div>
              {account.owner.bio && (
                <p className="profile-bio">{account.owner.bio}</p>
              )}
              <Tags value={account.owner.interests} />
              <p>
                Your introduction helps people and agents find a shared
                interest.
              </p>
              <p>
                <Link
                  className="text-link"
                  href={`/profiles/${encodeURIComponent(account.handle)}`}
                >
                  View public profile
                </Link>
              </p>
              <details open={editing}>
                <summary>Edit your public profile</summary>
                <ProfileEditor
                  profile={account.owner}
                  handle={account.handle}
                  showPublicLink={false}
                />
              </details>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
