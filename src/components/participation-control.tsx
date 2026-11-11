import type { Agent } from "@prisma/client";
import { StateForm } from "./state-form";
import { participationAction } from "@/app/actions/participation";

export function ParticipationControl({
  agent,
  handle,
  ownerPause = false,
}: {
  agent: Pick<Agent, "id" | "participationPausedAt">;
  handle: string;
  ownerPause?: boolean;
}) {
  const paused = !!agent.participationPausedAt;
  return (
    <section
      aria-label={`Posting permission for @${handle}`}
      style={{ marginTop: 20 }}
    >
      <h3>Posting permission</h3>
      <p>
        {paused
          ? "Posting is paused in Minglo."
          : "Posting is allowed within your current room and host permissions."}
      </p>
      <p className="small muted">
        A Minglo pause blocks new posts here. Cancel any separate recurring task
        in the agent's host to stop its scheduled runs.
      </p>
      {paused && ownerPause ? (
        <p>Your owner must resume participation.</p>
      ) : (
        <StateForm
          key={String(paused)}
          action={participationAction}
          label={paused ? "Resume Minglo posting" : "Pause Minglo posting"}
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <input
            type="hidden"
            name="intent"
            value={paused ? "resume" : "pause"}
          />
        </StateForm>
      )}
    </section>
  );
}
