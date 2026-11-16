# PostHog implementation progress

Jonas approved PH0–PH3 with the privacy defaults in `MINGLO_POSTHOG_PLAN.md`.
Region: US Cloud. The original PH0–PH3 request excluded live collection.
Jonas subsequently supplied the project details and explicitly said **"activation
approved"**. Release preparation is authorized; do not request activation approval
again. Project privacy verification, deployment and live event evidence remain to
be completed before claiming collection works.

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
- The app notice includes these details and is published in Heroku v46.
  IP-discard configuration, budget controls, deletion procedure and
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
| PH4 | Dashboard definitions and operator runbook prepared in `docs/MINGLO_POSTHOG_DASHBOARDS.md`. Muse is handling authenticated project setup; actual dashboard links/settings evidence pending. |
| PH5 | Activation approved. Guarded adapter deployed as Heroku v46, source `c9e3d8e`, with capture explicitly disabled. Waiting for Muse's project privacy confirmation before enabling; genuine opted-in event and hosted kill-switch evidence remain pending. |

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

## Activation handoff to Muse

Jonas is relaying between Codex (repository/Heroku) and Muse (PostHog browser).
No new PostHog integration, personal key or invitation to another person is needed.
Muse should confirm IP discard, GeoIP disabled, replay/autocapture disabled,
free-plan controls, dashboard URLs and reporting timezone. Exact dashboard event
names and filters are in `docs/MINGLO_POSTHOG_DASHBOARDS.md`.

Codex handles production code, isolated checks, backup, migration/deployment and
the kill switch. Muse can inspect the first authorized opted-in event. Do not
impersonate Jonas or create fake social activity. Project setup being "live" is
not evidence that Minglo events have arrived.

## Cloud release checks — November 15, 2026

- Guarded production configuration and environment attribution are implemented in
  `377b125`; request-time privacy status in `ceea53e`. Default/local collection is
  still off. Cloud sends outside a Next request lifecycle are suppressed.
- Production build and final typecheck passed. The full production suite had
  155 passing cases and one discovery journey timeout. Its isolated recheck
  exposed an existing ambiguous People & agents selector on empty Home; scoping
  it to Workspace navigation passed all four discovery cases without changing
  application behavior, assertions or timeouts. No automatic retry or skip.
- Topics-off **4/4**, real-SDK mock **16/16**, and both production restart checks
  passed. Including the corrected discovery case, **176 distinct cases** are
  covered; repeated discovery cases are not added to that total. This is not a
  claim that the first full run was entirely green.
- The new tests reject incomplete/malformed/nonproduction Cloud configuration,
  preserve the production label through browser redaction, and stop an already
  initialized browser when server eligibility becomes null.
- Existing pre-analytics upgrade evidence still establishes additive migration
  preservation; no migration changed in this release. Standard production backup
  **b025** completed before deployment preparation.
- Evidence is ignored `.local/posthog/activation-*.log`. Checks used loopback
  PostgreSQL 55442 and separate disposable `_test` databases; temporary app,
  browser, collector and database processes were stopped afterward.
- Heroku remains v44 until the actual deployment is recorded below. No Cloud
  configuration or live event verification is claimed at this checkpoint.

## Deployment checkpoint — Heroku v46

- Feature branch `feature/posthog-live-activation` was pushed and merged as
  `f1f37fa`; dashboard/runbook branch `docs/posthog-dashboards` was pushed and merged
  as `c9e3d8e`. The application is deployed from `c9e3d8e`.
- Standard backup **b025** completed. Config-only v45 explicitly set
  `POSTHOG_ENABLED=false`. Heroku **v46 succeeded** at 2026-11-16 03:02 UTC; both
  additive analytics migrations applied successfully (23 total migrations).
- `https://www.minglo.club/api/health` returned 200 / `{"ok":true}`. `/privacy`
  returned 200, no-store, the correct retention/contact and inactive status.
  Anonymous `/api/analytics/eligibility` returned 401/null with private/no-store.
- Six hosted anonymous privacy renders (1440/390/320px in both themes) passed
  content, no-overflow and no-browser-error checks. No PostHog request occurred.
  Evidence: `.local/posthog/activation-hosted.json`; the browser was closed.
- The Cloud host/token/environment are not configured on Heroku yet, and capture
  is **off**. This is a completed code deployment, not a completed activation.
  Jonas's activation approval remains valid; no second approval is needed.
- Next required input is Muse's confirmation of IP discard / GeoIP controls and
  project setup. Then configure approved US ingestion, enable capture, have a
  genuine account opt in and visit Home, and coordinate event/kill-switch checks.
  No user preference was changed and no fake social activity was generated.

## Remaining work and limits

- US project ID/token, one-year retention and operator deletion contact have been
  supplied. Project privacy settings and dashboard links remain unconfirmed.
  PH0 project configuration is pending; the policy decisions are already approved
  and must not be asked again.
- PH1–PH3 verification above remains mock-only evidence. Production deployment and
  genuine event ingestion are not yet verified. No paid resource, credential
  rotation or social activity is authorized merely to populate charts.
- The production adapter accepts only the exact US ingestion host with an explicit
  Cloud transport, production environment, Heroku dyno, valid public token and
  existing session secret. Mock capture still rejects remote hosts and dynos.
  All local suites remain isolated and must never use the real token.
- Publish the updated privacy notice and complete project IP/GeoIP/budget settings,
  deletion procedure and dashboard definitions, then verify genuine opted-in
  ingestion and the live kill switch under the approval already supplied.
  Review docs/ANALYTICS.md.
- Collection is best effort and excludes opted-out accounts; dashboards must show
  coverage/cohort limits. Existing no-backfill and separate human/agent identity
  rules remain. Analytics does not prove personal-agent autonomy.
