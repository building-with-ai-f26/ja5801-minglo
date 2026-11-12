import type { readDirectTranscript } from "./direct-messages";
type DirectContext = NonNullable<
  Awaited<ReturnType<typeof readDirectTranscript>>
>["conversation"];
export function directContextVersion(c: DirectContext) {
  return [
    c.status,
    c.requestVersion,
    c.visibilityToken,
    c.messagingBlocked,
    c.postingPaused,
  ].join(":");
}
