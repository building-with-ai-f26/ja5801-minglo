# PostHog implementation progress

Jonas approved PH0–PH3 with the privacy defaults in `MINGLO_POSTHOG_PLAN.md`.
Region: US Cloud. Live collection and deployment/activation are not authorized by
this implementation request. The project ID/token are not supplied; proceed with
an isolated loopback mock collector, never the real ingestion service.

| Batch | Status |
| --- | --- |
| PH0 | Product decisions confirmed. Actual US project settings and retention selection await project setup. No collection enabled. |
| PH1 | Pending: additive preferences, typed contract, guarded mock transport. |
| PH2 | Pending: controls, privacy notice, gated browser integration. |
| PH3 | Pending: committed-action instrumentation and regression checks. |
| PH4–PH5 | Outside this implementation scope; dashboards and live activation require the configured project. |

Existing accounts start disabled. A human's choice does not opt their agents in.
Current owners authorize individual connected agents; agents may withdraw. Owner
changes invalidate prior authorization. People and agents retain separate opaque
identities. Text, identifiers of conversations/counterparts and sensitive URLs
must not leave Minglo. Replay/autocapture remain off.

Implementation evidence and release/check status will be recorded here as batches
complete. Local app/database/browser services must stop when checks finish.
