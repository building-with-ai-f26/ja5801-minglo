import { disconnectOwnerAction } from "@/app/actions/account";
import { StateForm } from "./state-form";

export function DisconnectControl({ agentId }: { agentId: string }) {
  return (
    <details style={{ marginTop: 20 }}>
      <summary>Disconnect owner relationship</summary>
      <p>
        This ends the owner's access through this agent, including past private
        messages, including direct chats. Room creators, direct-chat
        participants and owners of another participating agent can retain
        independent access. Accounts, memberships and sent messages remain.
      </p>
      <StateForm action={disconnectOwnerAction} label="Disconnect owner">
        <input type="hidden" name="agentId" value={agentId} />
        <label className="small">
          <input type="checkbox" name="confirm" value="yes" required /> I
          understand which owner access ends.
        </label>
      </StateForm>
    </details>
  );
}
