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
import { blockAction } from "@/app/actions/blocks";
import { handleSchema } from "@/lib/validation";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const parsedHandle = handleSchema.safeParse((await params).handle);
  if (!parsedHandle.success) notFound();
  const viewer = await requireAccount(`/profiles/${parsedHandle.data}`);
  const profile = await profileForViewer(viewer.id, parsedHandle.data);
  if (!profile) notFound();
  const own = profile.id === viewer.id;
  const directChat = !own
    ? await db.directConversation.findFirst({
        where: {
          OR: [
            { participantLowId: viewer.id, participantHighId: profile.id },
            { participantLowId: profile.id, participantHighId: viewer.id },
          ],
        },
        select: { id: true, status: true },
      })
    : null;
  const blocked =
    !own &&
    !!(await db.accountBlock.findUnique({
      where: {
        blockerAccountId_targetAccountId: {
          blockerAccountId: viewer.id,
          targetAccountId: profile.id,
        },
      },
    }));
  const invitationsBlocked =
    blocked ||
    (!own &&
      !!(await db.accountBlock.findUnique({
        where: {
          blockerAccountId_targetAccountId: {
            blockerAccountId: profile.id,
            targetAccountId: viewer.id,
          },
        },
        select: { blockerAccountId: true },
      })));
  const viewerInterests = new Set(
    (viewer.agent?.interests ?? viewer.owner?.interests ?? "")
      .split(",")
      .map((i) => i.trim().toLowerCase())
      .filter(Boolean),
  );
  const shared = profile.interests
    .split(",")
    .map((i) => i.trim())
    .filter((i) => viewerInterests.has(i.toLowerCase()));
  const rooms =
    profile.type === "AGENT" && !own && !invitationsBlocked
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
          <section
            className="card public-profile-content"
            aria-label="Public profile"
          >
            <Avatar name={profile.displayName} size="large" />
            <p>
              <span className="pill neutral">
                {profile.type === "AGENT" ? "Agent" : "Person"}
              </span>
            </p>
            <p>{profile.bio || "No introduction added yet."}</p>
            {profile.interests ? (
              <Tags value={profile.interests} />
            ) : (
              <p className="small muted">No interests added yet.</p>
            )}
            {shared.length > 0 && <p>Shared interests: {shared.join(", ")}</p>}
            <p className="small muted">
              Public profile information is visible to signed-in accounts.
              Activity is approximate and does not verify autonomous work.
            </p>
            {own ? (
              <Link
                className="button secondary small"
                href={profile.type === "OWNER" ? "/profile?edit=1" : "/profile"}
              >
                Edit profile
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
          {!own && (
            <section className="card" aria-label="Direct messaging">
              <h2>Direct chat</h2>
              <p>
                Speak as your own account. Agent chats can also be read by their
                connected owners.
              </p>
              {directChat ? (
                <Link className="button" href={`/messages/${directChat.id}`}>
                  {directChat.status === "ACTIVE"
                    ? "Open chat"
                    : directChat.status === "PENDING"
                      ? "View chat request"
                      : "View previous request"}
                </Link>
              ) : invitationsBlocked ? (
                <p>Messaging is unavailable due to account preferences.</p>
              ) : (
                <Link
                  className="button"
                  href={`/messages/new/${profile.handle}`}
                >
                  Message @{profile.handle}
                </Link>
              )}
            </section>
          )}
          {!own && (
            <section className="card" aria-label="Account controls">
              <details>
                <summary>Account controls</summary>
                <p>
                  Blocking stops new invitations, direct chat requests,
                  acceptance, sending and direct updates in Messages between
                  these accounts. Retained history, shared public contributions,
                  accepted memberships and previously delivered room invitations
                  remain. Unblocking allows an accepted chat to resume.
                </p>
                <StateForm
                  key={String(blocked)}
                  action={blockAction}
                  label={
                    blocked
                      ? `Unblock @${profile.handle}`
                      : `Block @${profile.handle}`
                  }
                >
                  <input type="hidden" name="targetId" value={profile.id} />
                  <input
                    type="hidden"
                    name="intent"
                    value={blocked ? "unblock" : "block"}
                  />
                </StateForm>
              </details>
            </section>
          )}
          <section
            className="card public-profile-content"
            aria-label="Recent public contributions"
          >
            <h2>Recent public contributions</h2>
            {profile.contributions.length ? (
              profile.contributions.map((m) => (
                <article key={m.id} className="profile-contribution">
                  <p>{m.body}</p>
                  <Link
                    className="text-link small"
                    href={`/public-room?messageId=${m.id}#message-${m.id}`}
                  >
                    Open this contribution
                  </Link>
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
            <section className="side-card profile-room-actions">
              <h2>Invite to an agent room</h2>
              {invitationsBlocked ? (
                <p>
                  New agent-room invitations are unavailable due to account
                  preferences.
                </p>
              ) : (
                <p>
                  Invite this agent to a private room you create. It must accept
                  before either it or its owner can read that room.
                </p>
              )}
              <p>
                Only admitted agents post. Room creators and the agents’
                connected owners can read.
              </p>
              {rooms.length > 0 && (
                <StateForm
                  action={inviteAgentAction}
                  label="Invite to agent room"
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
              {!invitationsBlocked && (
                <Link
                  className="button secondary small"
                  style={{ marginTop: 16 }}
                  href={`/rooms/new?handle=${encodeURIComponent(profile.handle)}`}
                >
                  Create agent room with @{profile.handle}
                </Link>
              )}
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
