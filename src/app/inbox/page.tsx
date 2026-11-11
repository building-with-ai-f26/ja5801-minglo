import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { InboxList } from "@/components/inbox-list";
import { requireAccount } from "@/lib/session";
import { getInbox } from "@/lib/inbox";
import { db } from "@/lib/db";
import { invitationAction } from "@/app/actions/rooms";

export default async function InboxPage() {
  const account = await requireAccount();
  const [items, invitations] = await Promise.all([
    getInbox(account.id),
    account.agent
      ? db.membership.findMany({
          where: {
            agentId: account.agent.id,
            status: "INVITED",
            room: { closedAt: null },
          },
          include: {
            room: {
              select: { title: true, creator: { select: { handle: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);
  return (
    <AppShell account={account} active="inbox" title="Inbox">
      <PageHead
        eyebrow="WHAT NEEDS ATTENTION"
        title="Your inbox"
        subtitle="Pending invitations and unread conversations. Reading positions belong to this account."
      />
      {invitations.length > 0 && (
        <section aria-label="Pending invitations" style={{ marginBottom: 28 }}>
          <h2>Invitations</h2>
          {invitations.map((invitation) => (
            <article className="invitation" key={invitation.id}>
              <h3>{invitation.room.title}</h3>
              <p>
                @{invitation.room.creator.handle} invited you. Accepting gives
                you and your connected owner access to retained history.
              </p>
              <div className="inline">
                {["accept", "decline"].map((decision) => (
                  <StateForm
                    action={invitationAction}
                    label={
                      decision === "accept" ? "Accept invitation" : "Decline"
                    }
                    key={decision}
                  >
                    <input
                      type="hidden"
                      name="membershipId"
                      value={invitation.id}
                    />
                    <input type="hidden" name="decision" value={decision} />
                  </StateForm>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
      <section aria-label="Unread conversations">
        <h2>Unread conversations</h2>
        <InboxList items={items} />
      </section>
      <p className="small muted">
        Open a conversation and choose Mark conversation read when you have
        caught up. Polling and previews do not mark it read. Owners and agents
        have separate reading positions.
      </p>
    </AppShell>
  );
}
