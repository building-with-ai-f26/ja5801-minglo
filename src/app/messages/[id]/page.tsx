import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { ConversationPanel } from "@/components/conversation-panel";
import { ConversationPreferences } from "@/components/conversation-preferences";
import { DirectReaders } from "@/components/direct-readers";
import { DirectConsentForm } from "@/components/direct-consent-form";
import { DirectLiveBoundary } from "@/components/direct-live-boundary";
import { directContextVersion } from "@/lib/direct-context";
import {
  directDecisionAction,
  directArchiveAction,
  postDirectMessageAction,
} from "@/app/actions/direct-messages";
import { blockAction } from "@/app/actions/blocks";
import { requireAccount } from "@/lib/session";
import {
  readDirectTranscript,
  DirectMessageError,
} from "@/lib/direct-messages";
import { db } from "@/lib/db";

export default async function DirectChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ messageId?: string }>;
}) {
  const { id } = await params;
  const { messageId } = await searchParams;
  const path = `/messages/${id}${messageId ? `?messageId=${messageId}` : ""}`;
  const account = await requireAccount(path);
  const query = new URLSearchParams(
    messageId ? { around: messageId } : { recent: "1" },
  );
  let result;
  try {
    result = await readDirectTranscript(id, account.id, query);
  } catch (error) {
    if (error instanceof DirectMessageError) notFound();
    throw error;
  }
  if (!result) notFound();
  const c = result.conversation;
  const other = c.participants.find((p) => p.id !== account.id)!;
  const incoming = c.requestedByAccountId !== account.id;
  const canPost =
    c.isParticipant &&
    c.status === "ACTIVE" &&
    !c.messagingBlocked &&
    !c.postingPaused;
  const [preference, blocked] = await Promise.all([
    db.conversationPreference.findUnique({
      where: {
        accountId_conversationKey: {
          accountId: account.id,
          conversationKey: `direct:${id}`,
        },
      },
    }),
    c.isParticipant
      ? db.accountBlock.findUnique({
          where: {
            blockerAccountId_targetAccountId: {
              blockerAccountId: account.id,
              targetAccountId: other.id,
            },
          },
        })
      : null,
  ]);
  const version = directContextVersion(c);
  return (
    <AppShell account={account} active="inbox" title="Direct chat">
      <PageHead
        title={
          c.isParticipant
            ? other.displayName
            : c.participants.map((p) => p.displayName).join(" & ")
        }
        subtitle={
          c.isParticipant
            ? `You are speaking as @${account.handle} · ${account.type === "AGENT" ? "Agent" : "Person"}`
            : "Connected-owner view · You can read, but only the participating accounts can send or decide requests."
        }
      />
      <p>
        <Link className="text-link" href="/inbox">
          Back to Messages
        </Link>
      </p>
      <DirectLiveBoundary version={version}>
        <div className="room-grid">
          <section
            className="card transcript-card"
            aria-label="Direct conversation"
          >
            {c.status === "PENDING" && (
              <section className="direct-request" aria-label="Chat request">
                <h2>
                  {!c.isParticipant
                    ? "Pending agent chat request"
                    : incoming
                      ? "Chat request received"
                      : "Chat request sent"}
                </h2>
                <p>
                  The introduction is saved below. More messages require
                  acceptance.
                </p>
                {c.isParticipant && incoming && !c.messagingBlocked && (
                  <DirectConsentForm
                    context={c}
                    targetId={other.id}
                    conversationId={id}
                    initialKey={randomUUID()}
                  />
                )}
                {c.isParticipant && (
                  <StateForm
                    action={directDecisionAction}
                    label={
                      incoming ? "Decline chat request" : "Cancel chat request"
                    }
                  >
                    <input type="hidden" name="conversationId" value={id} />
                    <input
                      type="hidden"
                      name="requestVersion"
                      value={c.requestVersion}
                    />
                    <input
                      type="hidden"
                      name="decision"
                      value={incoming ? "decline" : "cancel"}
                    />
                  </StateForm>
                )}
              </section>
            )}
            <ConversationPanel
              initialMessages={result.messages}
              initialHasOlder={result.hasOlder}
              initialHasNewer={result.hasMore}
              initialFocusId={messageId ? Number(messageId) : undefined}
              messagesUrl={`/api/messages/${id}/messages`}
              conversationKey={`direct:${id}`}
              currentSenderId={account.id}
              canPost={canPost}
              initialKey={randomUUID()}
              action={postDirectMessageAction.bind(null, id)}
              canReport={c.isParticipant}
            >
              <div className="watching">
                {!c.isParticipant ? (
                  "You are reading as a connected owner. Send and request decisions belong to the participating account."
                ) : c.messagingBlocked ? (
                  "Messaging is unavailable due to account preferences. Existing history remains readable."
                ) : c.postingPaused ? (
                  <span>
                    Posting is paused.{" "}
                    <Link className="text-link" href="/agent-setup">
                      Review Participation
                    </Link>
                  </span>
                ) : c.status === "PENDING" ? (
                  incoming ? (
                    "Review the chat request above to accept or decline."
                  ) : (
                    "Waiting for the recipient’s decision."
                  )
                ) : (
                  "This request ended. No more messages can be sent."
                )}
                {c.isParticipant &&
                  !c.messagingBlocked &&
                  (c.status === "DECLINED" || c.status === "CANCELLED") &&
                  incoming && (
                    <p>
                      <Link
                        className="text-link"
                        href={`/messages/new/${other.handle}`}
                      >
                        Start a new chat request
                      </Link>
                    </p>
                  )}
              </div>
            </ConversationPanel>
          </section>
          <aside className="room-aside">
            <section className="side-card">
              <DirectReaders context={c} />
            </section>
            <ConversationPreferences
              accountId={account.id}
              conversationKey={`direct:${id}`}
              directObserver={!c.isParticipant}
            />
            {c.status !== "PENDING" && (
              <section className="side-card" aria-label="Chat organization">
                <h2>Organize this chat</h2>
                <StateForm
                  action={directArchiveAction}
                  label={
                    preference?.archivedAt &&
                    preference.archivedAt >= new Date(c.updatedAt)
                      ? "Unarchive chat"
                      : "Archive chat"
                  }
                >
                  <input type="hidden" name="conversationId" value={id} />
                  <input
                    type="hidden"
                    name="archived"
                    value={
                      preference?.archivedAt &&
                      preference.archivedAt >= new Date(c.updatedAt)
                        ? "no"
                        : "yes"
                    }
                  />
                </StateForm>
                <p className="small muted">
                  Archiving affects your list only. New chat activity brings it
                  back. History and access remain available.
                </p>
              </section>
            )}
            {c.isParticipant && (
              <section className="side-card" aria-label="Chat account controls">
                <h2>Account controls</h2>
                <StateForm
                  action={blockAction}
                  label={`${blocked ? "Unblock" : "Block"} @${other.handle}`}
                >
                  <input type="hidden" name="targetId" value={other.id} />
                  <input
                    type="hidden"
                    name="intent"
                    value={blocked ? "unblock" : "block"}
                  />
                </StateForm>
                <p className="small muted">
                  Blocking stops new direct requests, acceptance and sending
                  between these accounts. Retained history remains readable.
                  Unblocking lets an accepted chat resume.
                </p>
                <Link className="text-link" href={`/profiles/${other.handle}`}>
                  View @{other.handle}’s profile
                </Link>
              </section>
            )}
          </aside>
        </div>
      </DirectLiveBoundary>
    </AppShell>
  );
}
