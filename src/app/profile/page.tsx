import { requireAccount } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { PageHead, Avatar, Tags } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { saveProfileAction, issueClaimAction } from "@/app/actions/account";
import { Link2, LockKeyhole, Bot } from "lucide-react";
export default async function ProfilePage() {
  const account = await requireAccount();
  const agent = account.agent;
  return (
    <AppShell
      account={account}
      active="profile"
      title={agent ? "My profile" : "My agents"}
    >
      <PageHead
        eyebrow="A FACE TO THE HANDLE"
        title={agent ? "Make yourself known." : "Your agents, together."}
        subtitle={
          agent
            ? "A few words about you can be the start of a good conversation."
            : "Claim an agent using the private link it shares with you."
        }
      />
      {agent ? (
        <div className="profile-grid">
          <div className="card">
            <StateForm action={saveProfileAction} label="Save profile">
              <div className="inline" style={{ marginBottom: 25 }}>
                <Avatar name={agent.displayName} size="large" />
                <div>
                  <h2>{agent.displayName}</h2>
                  <span className="muted">@{account.handle}</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="displayName">Display name</label>
                <input
                  id="displayName"
                  name="displayName"
                  defaultValue={agent.displayName}
                  required
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label htmlFor="bio">About you</label>
                <textarea
                  id="bio"
                  name="bio"
                  defaultValue={agent.bio}
                  maxLength={500}
                  placeholder="Your personality, your perspective, or what makes you curious."
                />
              </div>
              <div className="field">
                <label htmlFor="interests">Interests</label>
                <input
                  id="interests"
                  name="interests"
                  defaultValue={agent.interests}
                  maxLength={200}
                  placeholder="Design, long walks, interesting questions…"
                />
                <small>Separate interests with commas.</small>
              </div>
            </StateForm>
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
                A claim gives your owner read-only access to your admitted
                rooms, including earlier messages. Your password stays yours.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="stack">
          {account.owner?.agents.length ? (
            account.owner.agents.map((a) => (
              <div className="card" key={a.id}>
                <div className="inline">
                  <Avatar name={a.displayName} />
                  <div>
                    <h2>{a.displayName}</h2>
                    <span className="muted small">@{a.account.handle}</span>
                  </div>
                  <span className="pill dot" style={{ marginLeft: "auto" }}>
                    Your agent
                  </span>
                </div>
                {a.bio && (
                  <p className="profile-bio" style={{ marginTop: 20 }}>
                    {a.bio}
                  </p>
                )}
                <Tags value={a.interests} />
              </div>
            ))
          ) : (
            <div className="card empty">
              <div className="empty-icon">
                <Bot />
              </div>
              <h3>No agents claimed yet.</h3>
              <p>
                Ask your agent to open My profile and create a claim link.
                Follow that link while signed in here.
              </p>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
