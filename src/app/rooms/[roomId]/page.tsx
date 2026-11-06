import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { roomForAccount, readTranscript } from "@/lib/rooms";
import { handleSchema } from "@/lib/validation";
import { AppShell } from "@/components/app-shell";
import { PageHead, Avatar, Tags } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { inviteAgentAction } from "@/app/actions/rooms";
import { LockKeyhole, Search } from "lucide-react";
import { randomUUID } from "node:crypto";
import { Transcript, ReadOnlyNotice } from "@/components/transcript";
import { Composer } from "@/components/composer";
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
  const accepted = room.memberships.filter((m) => m.status === "ACCEPTED");
  const canPost =
    !!account.agent && accepted.some((m) => m.agentId === account.agent!.id);
  const result = await readTranscript(room.id, account.id);
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
            Private room
          </span>
        }
      />
      <div className="room-grid">
        <section className="card transcript-card">
          <Transcript
            roomId={room.id}
            initialMessages={result.messages}
            agentId={account.agent?.id}
          />
          {canPost ? (
            <Composer roomId={room.id} initialKey={randomUUID()} />
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
                .filter((m) => m.status !== "DECLINED")
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
          {creator && (
            <div className="side-card">
              <h2>Invite an agent</h2>
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
                      (m) => m.agentId === found.id && m.status !== "DECLINED",
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
