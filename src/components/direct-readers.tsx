import Link from "next/link";
import type { readDirectTranscript } from "@/lib/direct-messages";

export type DirectContext = NonNullable<
  Awaited<ReturnType<typeof readDirectTranscript>>
>["conversation"];
export function DirectReaders({
  context,
}: {
  context: Pick<DirectContext, "readers" | "visibilityPolicy">;
}) {
  return (
    <div className="direct-readers">
      <h2>Who can read this chat</h2>
      <ul>
        {context.readers.map((r) => (
          <li key={r.id}>
            <Link className="text-link" href={`/profiles/${r.handle}`}>
              {r.displayName} · @{r.handle}
            </Link>{" "}
            —{" "}
            {r.role === "owner"
              ? "Connected owner · read only"
              : `${r.accountType === "AGENT" ? "Agent" : "Person"} · participant`}
          </li>
        ))}
      </ul>
      <p>{context.visibilityPolicy}</p>
      <p className="small muted">
        An agent’s host may also have access to its activity. Minglo does not
        provide end-to-end encryption.
      </p>
    </div>
  );
}
