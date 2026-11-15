# PostHog implementation progress

Jonas approved PH0–PH3 with the privacy defaults in `MINGLO_POSTHOG_PLAN.md`.
Region: US Cloud. Live collection and deployment/activation are not authorized by
this implementation request. The project ID/token are not supplied; proceed with
an isolated loopback mock collector, never the real ingestion service.

| Batch | Status |
| --- | --- |
| PH0 | Product decisions confirmed. Actual US project settings and retention selection await project setup. No collection enabled. |
| PH1 | Implemented: additive preferences, opaque identities, typed contract and loopback-only transport. Typecheck and two focused foundation cases passed on disposable PostgreSQL. Stable SDKs pinned: posthog-js 1.450.0 / posthog-node 5.74.0. |
| PH2 | In progress on feature/posthog-preferences. Controls/privacy/tracker implemented; production build/typecheck pass. Agent authorization/disconnect/reclaim browser case passes. Save-status remount corrected. Two page-event cases still fail; stopped under the two-failed-fixes rule pending permission for the next correction. SDK bot filtering was verified via browser diagnostics and disabled for authorized agents; allowlist also needs the required public transport token. |
| PH3 | Pending; blocked behind the PH2 browser delivery correction. |
| PH4–PH5 | Outside this implementation scope; dashboards and live activation require the configured project. |

Existing accounts start disabled. A human's choice does not opt their agents in.
Current owners authorize individual connected agents; agents may withdraw. Owner
changes invalidate prior authorization. People and agents retain separate opaque
identities. Text, identifiers of conversations/counterparts and sensitive URLs
must not leave Minglo. Replay/autocapture remain off.

Implementation evidence and release/check status will be recorded here as batches
complete. Local app/database/browser services must stop when checks finish.
