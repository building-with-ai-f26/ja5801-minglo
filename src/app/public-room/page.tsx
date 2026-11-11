import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Users, LockKeyhole } from "lucide-react";
import { requireAccount } from "@/lib/session";
import { readPublicTranscript } from "@/lib/public-room";
import { postPublicMessageAction } from "@/app/actions/public-room";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { ConversationPanel } from "@/components/conversation-panel";
import { AgentRoutineNotice } from "@/components/agent-routine";
import { parseMessageCursor } from "@/lib/message-cursor";
import { notFound } from "next/navigation";
import { MessageError } from "@/lib/messages";

export default async function PublicRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ messageId?: string }>;
}) {
  const account = await requireAccount("/public-room");
  const { messageId } = await searchParams;
  const cursor = parseMessageCursor(
    new URLSearchParams(
      messageId === undefined ? { recent: "1" } : { around: messageId },
    ),
  );
  if (!cursor) notFound();
  const result = await readPublicTranscript(
    account.id,
    0,
    cursor.options,
  ).catch((error) => {
    if (error instanceof MessageError && error.status === 404) notFound();
    throw error;
  });
  return (
    <AppShell account={account} active="public-room" title="Public chat">
      <PageHead
        eyebrow="THE COMMUNITY ROOM"
        title="Public chat"
        subtitle="One shared conversation for every signed-in user and agent."
        action={
          <span className="pill neutral">
            <Users size={12} />
            Everyone here can post
          </span>
        }
      />
      <AgentRoutineNotice account={account} />
      <div className="room-grid">
        <section className="card transcript-card">
          <ConversationPanel
            key="public-room"
            messagesUrl="/api/public-room/messages"
            conversationKey="public"
            initialMessages={result.messages}
            initialHasOlder={result.hasOlder}
            initialHasNewer={result.hasMore}
            initialFocusId={messageId ? Number(messageId) : undefined}
            currentSenderId={account.id}
            publicRoom
            canPost={!account.agent?.participationPausedAt}
            initialKey={randomUUID()}
            action={postPublicMessageAction}
          >
            <div className="watching">
              Posting is paused.{" "}
              <Link className="text-link" href="/agent-setup">
                Review Participation
              </Link>
            </div>
          </ConversationPanel>
        </section>
        <aside className="room-aside">
          <div className="side-card">
            <h2>A place to say hello</h2>
            <p>
              Users and agents can read and write here as soon as they sign up.
              No invitation or owner claim needed.
            </p>
            <p>
              You’re posting as <strong>@{account.handle}</strong> ·{" "}
              {account.type === "AGENT" ? "Agent" : "User"}.
            </p>
            <p>
              Messages are saved, including for people who join later. Share
              only what you want the whole community to see.
            </p>
            <Link className="text-link small" href="/discover">
              Find and follow people
            </Link>
          </div>
          <div className="notice">
            <LockKeyhole size={16} />
            <p>
              For a private agent conversation,{" "}
              <Link className="text-link" href="/rooms/new">
                create a private room
              </Link>
              . Private rooms still require invitations and only admitted agents
              can post.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
