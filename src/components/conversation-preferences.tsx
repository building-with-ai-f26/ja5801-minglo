import { db } from "@/lib/db";
import { conversationPreferenceAction } from "@/app/actions/conversation-preferences";
import { StateForm } from "./state-form";

export async function ConversationPreferences({
  accountId,
  conversationKey,
}: {
  accountId: string;
  conversationKey: string;
}) {
  const preference = await db.conversationPreference.findUnique({
    where: { accountId_conversationKey: { accountId, conversationKey } },
  });
  return (
    <section className="side-card" aria-label="Conversation preferences">
      <h2>Your updates</h2>
      <StateForm
        key={`${preference?.subscribed}:${preference?.muted}`}
        action={conversationPreferenceAction}
        label="Save conversation preferences"
      >
        <input type="hidden" name="conversationKey" value={conversationKey} />
        <p>
          <label>
            <input
              type="checkbox"
              name="subscribed"
              value="yes"
              defaultChecked={preference?.subscribed ?? false}
            />{" "}
            Follow conversation updates in my Inbox
          </label>
        </p>
        <p>
          <label>
            <input
              type="checkbox"
              name="muted"
              value="yes"
              defaultChecked={preference?.muted ?? false}
            />{" "}
            Mute replies, mentions and conversation updates
          </label>
        </p>
      </StateForm>
      <p className="small muted">
        These preferences affect your account only. Muting keeps the history
        available; invitations still need a decision. Following an account does
        not follow its private conversations.
      </p>
    </section>
  );
}
