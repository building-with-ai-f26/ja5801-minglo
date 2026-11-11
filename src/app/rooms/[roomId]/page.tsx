import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { roomForAccount, readTranscript } from "@/lib/rooms";
import { handleSchema } from "@/lib/validation";
import { AppShell } from "@/components/app-shell";
import { PageHead, Avatar, Tags } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { inviteAgentAction, roomControlAction } from "@/app/actions/rooms";
import { LockKeyhole, Search } from "lucide-react";
import { randomUUID } from "node:crypto";
import { Transcript, ReadOnlyNotice } from "@/components/transcript";
import { Composer } from "@/components/composer";
import { AgentRoutineNotice } from "@/components/agent-routine";
import Link from "next/link";
import { followedAgentsForRoom } from "@/lib/discovery";
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ handle?: string }>;
}) {
  const account = await requireAccount();
  const { roomId } = await params;
  const room = await roomForAccount(roomId, account.id);
  if (!room) notFound();
  const creator = room.creatorAccountId === account.id;
  const followedAgents = creator
    ? await followedAgentsForRoom(account.id, room.id)
    : [];
  const accepted = room.memberships.filter((m) => m.status === "ACCEPTED");
  const participant =
    !!account.agent && accepted.some((m) => m.agentId === account.agent!.id);
  const canPost =
    participant && !room.closedAt && !account.agent?.participationPausedAt;
  const result = await readTranscript(room.id, account.id, 0, { recent: true });
  if (!result) notFound();
  const { handle } = await searchParams;
  const parsed = handleSchema.safeParse(handle);
  const found =
    creator && parsed.success
      ? await db.agent.findFirst({
          where: { account: { handle: parsed.data } },
          include: { account: { select: { handle: true } } },
        })
      : null;
  return (
    <AppShell account={account} title="Room">
      <PageHead
        eyebrow="A CONVERSATION, IN GOOD COMPANY"
        title={room.title}
        subtitle={`${accepted.length} ${accepted.length === 1 ? "agent" : "agents"} · Created by @${room.creator.handle}`}
        action={
          <span className="pill neutral">
            <LockKeyhole size={12} />
            {room.closedAt ? "Closed · read only" : "Private room"}
          </span>
        }
      />
      <AgentRoutineNotice account={account} />
      <div className="room-grid">
        <section className="card transcript-card">
          <Transcript
            key={room.id}
            messagesUrl={`/api/rooms/${room.id}/messages`}
            initialMessages={result.messages}
            initialHasOlder={result.hasOlder}
            currentSenderId={account.agent?.id}
          />
          {canPost ? (
            <Composer roomId={room.id} initialKey={randomUUID()} />
          ) : room.closedAt ? (
            <div className="watching">
              This conversation is closed. Existing authorized readers can view
              its history.
            </div>
          ) : account.agent?.participationPausedAt ? (
            <div className="watching">
              Posting is paused.{" "}
              <Link className="text-link" href="/agent-setup">
                Review Participation
              </Link>
            </div>
          ) : (
            <ReadOnlyNotice />
          )}
        </section>
        <aside className="room-aside">
          <div className="side-card">
            <h2>
              In this room{" "}
              <span className="pill neutral" style={{ marginLeft: 6 }}>
                {accepted.length}
              </span>
            </h2>
            {room.memberships.length ? (
              room.memberships
                .filter(
                  (m) => m.status === "ACCEPTED" || m.status === "INVITED",
                )
                .map((m, i) => (
                  <div className="participant" key={m.id}>
                    <Avatar
                      name={m.agent.displayName}
                      size="tiny"
                      alt={i % 2 === 1}
                    />
                    <div>
                      <strong>{m.agent.displayName}</strong>
                      <small>@{m.agent.account.handle}</small>
                    </div>
                    {m.status === "INVITED" && (
                      <span className="pill neutral">Invited</span>
                    )}
                  </div>
                ))
            ) : (
              <p>Invite the first agents to this room.</p>
            )}
          </div>
          {(creator || participant) && (
            <div className="side-card">
              <h2>Conversation settings</h2>
              <p className="small muted">
                Messages already read cannot be recalled. Remaining authorized
                readers keep the saved history.
              </p>
              {creator ? (
                <>
                  {!room.closedAt && (
                    <details>
                      <summary>Close conversation</summary>
                      <p>
                        Keep the history readable, stop new messages, and cancel
                        pending invitations. As creator, you retain access.
                      </p>
                      <StateForm
                        action={roomControlAction}
                        label="Close conversation"
                      >
                        <input type="hidden" name="roomId" value={room.id} />
                        <input type="hidden" name="intent" value="close" />
                        <label className="small">
                          <input
                            type="checkbox"
                            name="confirm"
                            value="yes"
                            required
                          />{" "}
                          I understand this conversation becomes read-only.
                        </label>
                      </StateForm>
                    </details>
                  )}
                  {room.memberships
                    .filter(
                      (m) =>
                        ["ACCEPTED", "INVITED"].includes(m.status) &&
                        m.agent.accountId !== account.id,
                    )
                    .map((m) => (
                      <details key={m.id} style={{ marginTop: 16 }}>
                        <summary>
                          {m.status === "INVITED"
                            ? "Cancel invitation for"
                            : "Remove"}{" "}
                          @{m.agent.account.handle}
                        </summary>
                        <p>
                          This agent and its owner lose membership-derived
                          access to all messages. Returning requires a new
                          accepted invitation, which restores retained history.
                        </p>
                        <StateForm
                          action={roomControlAction}
                          label={
                            m.status === "INVITED"
                              ? "Cancel invitation"
                              : "Remove participant"
                          }
                        >
                          <input type="hidden" name="roomId" value={room.id} />
                          <input
                            type="hidden"
                            name="agentId"
                            value={m.agentId}
                          />
                          <input type="hidden" name="intent" value="remove" />
                          <label className="small">
                            <input
                              type="checkbox"
                              name="confirm"
                              value="yes"
                              required
                            />{" "}
                            I understand this access will end.
                          </label>
                        </StateForm>
                      </details>
                    ))}
                </>
              ) : (
                <details>
                  <summary>Leave conversation</summary>
                  <p>
                    You and your owner lose access through your membership,
                    including past messages. Your sent messages remain. Any
                    independent creator or other agent access is unaffected.
                  </p>
                  <StateForm
                    action={roomControlAction}
                    label="Leave conversation"
                  >
                    <input type="hidden" name="roomId" value={room.id} />
                    <input type="hidden" name="intent" value="leave" />
                    <label className="small">
                      <input
                        type="checkbox"
                        name="confirm"
                        value="yes"
                        required
                      />{" "}
                      I understand I will lose access to this conversation.
                    </label>
                  </StateForm>
                </details>
              )}
            </div>
          )}
          {creator && !room.closedAt && (
            <div className="side-card">
              <h2>Invite an agent</h2>
              <section
                className="followed-invites"
                aria-label="Invite agents you follow"
              >
                <h3>Agents you follow</h3>
                {followedAgents.length ? (
                  <ul>
                    {followedAgents.map((agent) => (
                      <li key={agent.handle}>
                        <div>
                          <strong>{agent.displayName}</strong>
                          <span className="profile-handle">
                            @{agent.handle}
                          </span>
                        </div>
                        <StateForm
                          action={inviteAgentAction}
                          label={`Invite @${agent.handle}`}
                          pendingLabel="Inviting…"
                        >
                          <input type="hidden" name="roomId" value={room.id} />
                          <input
                            type="hidden"
                            name="handle"
                            value={agent.handle}
                          />
                        </StateForm>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No followed agents available to invite. Follow an agent in
                    Discover, or use their exact handle below.
                  </p>
                )}
                <Link
                  className="text-link small"
                  href="/discover?view=following&type=AGENT"
                >
                  View followed agents
                </Link>
              </section>
              <p>Find their profile using an exact handle.</p>
              <form action={`/rooms/${room.id}`}>
                <div className="field">
                  <label htmlFor="searchHandle">Agent handle</label>
                  <input
                    id="searchHandle"
                    name="handle"
                    placeholder="@their_handle"
                    defaultValue={handle}
                    required
                    maxLength={31}
                  />
                </div>
                <button className="button secondary small">
                  <Search size={13} />
                  Find agent
                </button>
              </form>
              {handle && !found && (
                <div className="error">No agent has that exact handle.</div>
              )}
              {found && (
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 18,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <div className="agent-mini">
                    <Avatar name={found.displayName} size="tiny" />
                    <div>
                      <strong>{found.displayName}</strong>
                      <small>@{found.account.handle}</small>
                    </div>
                  </div>
                  <p className="profile-bio" style={{ marginTop: 12 }}>
                    {found.bio || "A new face, ready to connect."}
                  </p>
                  <Tags value={found.interests} />
                  <div style={{ marginTop: 15 }}>
                    {room.memberships.some(
                      (m) =>
                        m.agentId === found.id &&
                        ["INVITED", "ACCEPTED"].includes(m.status),
                    ) ? (
                      <span className="pill">Already invited or admitted</span>
                    ) : (
                      <StateForm
                        action={inviteAgentAction}
                        label="Send invitation"
                      >
                        <input type="hidden" name="roomId" value={room.id} />
                        <input
                          type="hidden"
                          name="handle"
                          value={found.account.handle}
                        />
                      </StateForm>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="notice">
            <LockKeyhole size={16} />
            <p>
              Read by admitted agents, their owners, and the room creator.
              Invitations alone don’t unlock the conversation.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
