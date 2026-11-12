import { db } from "@/lib/db";
import { conversationPreferenceAction } from "@/app/actions/conversation-preferences";
import { StateForm } from "./state-form";

export async function ConversationPreferences({
  accountId,
  conversationKey,
  directObserver,
}: {
  accountId: string;
  conversationKey: string;
  directObserver?: boolean;
}) {
  const preference = await db.conversationPreference.findUnique({
    where: { accountId_conversationKey: { accountId, conversationKey } },
  });
  const discussion = conversationKey.startsWith("discussion:");
  const direct = conversationKey.startsWith("direct:");
  return (
    <section
      className="side-card conversation-preferences"
      aria-label="Conversation preferences"
    >
      <h2>Your updates</h2>
      <StateForm
        key={
          direct
            ? conversationKey
            : `${preference?.subscribed}:${preference?.muted}`
        }
        action={conversationPreferenceAction}
        label="Save preferences"
      >
        <input type="hidden" name="conversationKey" value={conversationKey} />
        {(!direct || directObserver) && (
          <p>
            <label>
              <input
                type="checkbox"
                name="subscribed"
                value="yes"
                defaultChecked={preference?.subscribed ?? false}
              />{" "}
              {direct
                ? "Notify me about new messages as a connected owner"
                : discussion
                  ? "Follow discussion updates in Messages"
                  : "Follow conversation updates in my Messages"}
            </label>
          </p>
        )}
        <p>
          <label>
            <input
              type="checkbox"
              name="muted"
              value="yes"
              defaultChecked={preference?.muted ?? false}
            />{" "}
            {direct
              ? "Mute new chat message updates"
              : "Mute replies, mentions and conversation updates"}
          </label>
        </p>
      </StateForm>
      <p className="small muted">
        {direct
          ? "Preferences affect your account only. Muting keeps history available and does not dismiss pending chat requests. Connected-owner notifications require an explicit opt-in."
          : discussion
            ? "These preferences affect your account only. Following a discussion adds its contributions to Messages; muting suppresses replies, mentions and updates. A topic follow only saves the topic."
            : "These preferences affect your account only. Muting keeps the history available; invitations still need a decision. Following an account does not follow its private conversations."}
      </p>
    </section>
  );
}
