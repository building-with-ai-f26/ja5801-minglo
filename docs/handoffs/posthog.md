# PostHog implementation progress

Jonas approved PH0–PH3 with the privacy defaults in `MINGLO_POSTHOG_PLAN.md`.
Region: US Cloud. Live collection and deployment/activation are not authorized by
this implementation request. Project details have now been supplied (see below);
continue using the isolated loopback mock collector until activation is approved.

## Project setup supplied by Jonas

- Project: [739580](https://us.posthog.com/project/739580/home), US Cloud.
- Organization: Minglo; project display name: Default project. Jonas reports the
  free tier and registration under his Stern email. These account settings have
  not been independently inspected from an authenticated session.
- Jonas supplied the public ingestion token in chat. It is not a personal API key;
  keep deployment configuration in environment settings, not this document. No
  live token has been installed in the app or Heroku.
- Jonas confirmed event retention is **Organization default (1 year)** under
  Project > Product analytics, and approved **ja5801@stern.nyu.edu** as the public
  privacy/deletion contact. The address belongs in Minglo's `/privacy` notice;
  it does not require a PostHog settings field.
- The app notice now includes these details; publication awaits an approved
  deployment. IP-discard configuration, budget controls, deletion procedure and
  actual dashboard links still require confirmation/setup. Jonas reports making
  no project changes and that collection remains off.
- The notice-only update passed `npm run typecheck` and `git diff --check`.
  No app/database services were started and no analytics configuration changed.
- This confirms creation of the PostHog project, not live Minglo collection or
  approval to activate it. Do not add the default snippet to `docs/index.html`:
  that separate marketing page is outside the approved signed-in app scope.

| Batch | Status |
| --- | --- |
| PH0 | Project details, one-year retention and public deletion contact supplied. IP/GeoIP/budget controls and deletion procedure still need verification. No collection enabled. |
| PH1 | Implemented: additive preferences, opaque identities, typed contract and loopback-only transport. Typecheck and two focused foundation cases passed on disposable PostgreSQL. Stable SDKs pinned: posthog-js 1.450.0 / posthog-node 5.74.0. |
| PH2 | Implemented. Production build/typecheck and three SDK mock-browser cases pass: sanitized pages, cross-tab withdrawal/account switching, and agent authorization/disconnect/reclaim. The user approved continuing after the two-failed-fixes pause. Required public token retained; SDK bot filtering disabled for authorized agent browsers; local collector accepts the test helper’s synthetic router header. |
| PH3 | Implemented: committed onboarding/social/conversation/routine events, retry deduplication, consent revisions and owner observations. Final validation is recorded below. |
| PH4–PH5 | Outside this implementation scope; dashboards and live activation require the configured project. |

Existing accounts start disabled. A human's choice does not opt their agents in.
Current owners authorize individual connected agents; agents may withdraw. Owner
changes invalidate prior authorization. People and agents retain separate opaque
identities. Text, identifiers of conversations/counterparts and sensitive URLs
must not leave Minglo. Replay/autocapture remain off.

Implementation evidence and release/check status will be recorded here as batches
complete. Local app/database/browser services must stop when checks finish.

## Final implementation and verification — November 15, 2026

- PH1 foundation branch: `feature/posthog-foundation`, source `287b3b7`, merged
  as `31a9c3b`. PH2: `feature/posthog-preferences`, commits `555fe15`, `ac29f7b`,
  `f141302`, `9217e29`, merged as `0f21c23`. PH3 uses
  `feature/posthog-product-events`, source through `ce4da6b`, with focused commits for consent revisions,
  onboarding, contributions, read-only owner observations and verification.
- Full normal production suite: **155/155 passed**. Separately served Topics-off:
  **4/4 passed**. Final mock integration suite: **15/15 passed**. These total
  **174 distinct cases**; the final 12-case tutorial/contract subset and timing
  assertion recheck are repeats, not extra distinct cases. No test assertions or
  timeouts were weakened. No skips or automatic retries.
- Production build/typecheck passed. The full suite validated the application
  hooks; afterward final SDK controls explicitly retained GeoIP disabling and
  suppressed raw SDK HTTP logging, and an optional tour timestamp was made unable
  to block core behavior. The final production build passed the 15-case mock suite,
  the existing 12-case tutorial/contract subset and both restart checks.
- Both additive migrations were applied to a separately seeded pre-analytics
  schema. All **25 existing table fingerprints** stayed identical, and existing
  accounts had no AnalyticsPreference rows. The disposable upgraded schema has
  23 migrations. No shared or production database was migrated.
- **36** owner/agent settings, My agents, privacy and person/agent registration
  renders at 1440/390/320px in both themes had no horizontal overflow or browser
  page errors. New save targets were at least 44px; representative originals were
  inspected. No physical-device or screen-reader session is claimed.
- The mock tests use the actual installed SDKs and check redaction of text,
  names/handles, raw paths/queries/fragments, SDK person properties and retry keys;
  atomic human signup consent; refused agent self-opt-in; owner authorization;
  cross-tab withdrawal/account switching; disconnect/reclaim; consent revisions;
  CSRF/session recovery; actual profile changes; committed message/follow/topic/DM
  events; rollback; successful operation during collector outage; quiet SDK errors;
  and observed owner versus agent attribution. Bot detection is not autonomy proof.
- Tour replay retries retain their event UUID/time for eventual PostHog ingestion
  deduplication; the mock collector intentionally does not perform ingestion dedup.
  Failed preference saves keep the user's visible checkbox choice and allow retry.
  The user-approved third capture correction preserved the public project token;
  browser tracing then identified the separate mock CORS/header issue. The
  subsequent test cases all passed. The earlier stop and approval remain recorded.

Evidence: ignored `.local/posthog/` includes build/test logs, SDK diagnostic traces,
`upgrade.json`, `visual.json` and `previews/`. Tests used loopback-only PostgreSQL
55442 with disposable `_test` databases, app 3100, mock collector 3150, Topics-off
3106, restart 3105 and an independent visual server 3117. Temporary services are
shut down after checks; shared local services are not managed by these scripts.

## Remaining work and limits

- US project ID/token, one-year retention and operator deletion contact have been
  supplied. Project privacy settings and dashboard links remain unconfirmed.
  PH0 project configuration is pending; the policy decisions are already approved
  and must not be asked again.
- PH4 dashboards and PH5 deployment/live activation are outside the completed
  mock-only implementation. No Heroku/config change, real event ingestion,
  production fixture, outbound invitation/post, paid service or credential rotation
  was performed.
- Current code **rejects remote ingestion hosts and Heroku dynos** even if someone
  sets POSTHOG_ENABLED=true. Actual Cloud configuration support must be reviewed
  at activation time with the selected US project. Do not silently relax guards.
- Publish the updated privacy notice and complete project IP/GeoIP/budget settings,
  deletion procedure and dashboard definitions before asking Jonas for live
  activation approval. Only after that approval, verify genuine opted-in ingestion
  and the live kill switch. Review docs/ANALYTICS.md.
- Collection is best effort and excludes opted-out accounts; dashboards must show
  coverage/cohort limits. Existing no-backfill and separate human/agent identity
  rules remain. Analytics does not prove personal-agent autonomy.
