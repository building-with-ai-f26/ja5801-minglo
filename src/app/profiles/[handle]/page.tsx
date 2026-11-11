import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead, Avatar, Tags } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { followAction } from "@/app/actions/discovery";
import { inviteAgentAction } from "@/app/actions/rooms";
import { profileForViewer } from "@/lib/discovery";
import { requireAccount } from "@/lib/session";
import { db } from "@/lib/db";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const viewer = await requireAccount();
  const profile = await profileForViewer(viewer.id, (await params).handle);
  if (!profile) notFound();
  const own = profile.id === viewer.id;
  const viewerInterests = new Set(
    (viewer.agent?.interests ?? "")
      .split(",")
      .map((i) => i.trim().toLowerCase())
      .filter(Boolean),
  );
  const shared = profile.interests
    .split(",")
    .map((i) => i.trim())
    .filter((i) => viewerInterests.has(i.toLowerCase()));
  const rooms =
    profile.type === "AGENT" && !own
      ? await db.room.findMany({
          where: {
            creatorAccountId: viewer.id,
            closedAt: null,
            memberships: {
              none: {
                status: { in: ["INVITED", "ACCEPTED"] },
                agent: { accountId: profile.id },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, title: true },
        })
      : [];
  return (
    <AppShell account={viewer} active="discover" title={`@${profile.handle}`}>
      <PageHead
        eyebrow={profile.type === "AGENT" ? "AGENT PROFILE" : "USER PROFILE"}
        title={profile.displayName}
        subtitle={`@${profile.handle} · ${profile.activity}`}
      />
      <div className="profile-grid">
        <div className="stack">
          <section className="card" aria-label="Public profile">
            <Avatar name={profile.displayName} size="large" />
            <p>{profile.bio || "No introduction added yet."}</p>
            <Tags value={profile.interests} />
            {shared.length > 0 && <p>Shared interests: {shared.join(", ")}</p>}
            <p className="small muted">
              Public profile information is visible to signed-in accounts.
              Activity is approximate and does not verify autonomous work.
            </p>
            {own ? (
              <Link className="button secondary small" href="/profile">
                Manage your profile
              </Link>
            ) : (
              <StateForm
                key={String(profile.isFollowing)}
                action={followAction}
                label={profile.isFollowing ? "Unfollow" : "Follow"}
              >
                <input type="hidden" name="targetId" value={profile.id} />
                <input
                  type="hidden"
                  name="intent"
                  value={profile.isFollowing ? "unfollow" : "follow"}
                />
              </StateForm>
            )}
          </section>
          <section className="card" aria-label="Recent public contributions">
            <h2>Recent public contributions</h2>
            {profile.contributions.length ? (
              profile.contributions.map((m) => (
                <article key={m.id} style={{ marginTop: 18 }}>
                  <p>{m.body}</p>
                  <small className="muted">
                    <time dateTime={m.createdAt.toISOString()}>
                      {m.createdAt.toLocaleString("en-US", { timeZone: "UTC" })}{" "}
                      UTC
                    </time>
                  </small>
                </article>
              ))
            ) : (
              <p>No public contributions yet.</p>
            )}
            <Link className="text-link small" href="/public-room">
              Open public chat
            </Link>
          </section>
        </div>
        {profile.type === "AGENT" && !own && (
          <aside className="stack">
            <section className="side-card">
              <h2>Start a conversation</h2>
              <p>
                Invite this agent to a private room you create. It must accept
                before either it or its owner can read that room.
              </p>
              {rooms.length > 0 && (
                <StateForm
                  action={inviteAgentAction}
                  label="Invite to conversation"
                >
                  <input type="hidden" name="handle" value={profile.handle} />
                  <div className="field">
                    <label htmlFor="roomId">Your conversation</label>
                    <select id="roomId" name="roomId">
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </StateForm>
              )}
              <Link
                className="button secondary small"
                style={{ marginTop: 16 }}
                href={`/rooms/new?handle=${encodeURIComponent(profile.handle)}`}
              >
                Create a conversation with @{profile.handle}
              </Link>
              <p className="small muted">
                Following does not grant private access or accept invitations.
              </p>
            </section>
          </aside>
        )}
      </div>
    </AppShell>
  );
}
