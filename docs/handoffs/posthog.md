# PostHog implementation progress

**Latest scope update:** Jonas approved Christian's Build 2 Product Page snippet,
publication and evidence work, with no new Heroku push. The separate page now has
its own opt-in controller; this supersedes the original marketing-page exclusion
below. App v49 stays unchanged. See `docs/BUILD2_SUBMISSION.md` for current page
checks and outstanding dashboard/replay evidence.

Jonas approved PH0–PH3 with the privacy defaults in `MINGLO_POSTHOG_PLAN.md`.
Region: US Cloud. The original PH0–PH3 request excluded live collection.
Jonas subsequently supplied the project details and explicitly said **"activation
approved"**. Release preparation is authorized; do not request activation approval
again. Muse has confirmed project privacy settings, and Heroku v47 enables the
deployed integration. Muse has now verified real opted-in browser ingestion.
Capture is restored on Heroku v49 after Jonas ended the manual kill-switch trial.

## Subsequent Build 2 Product Page authorization

Jonas relayed Christian's request to add the full web snippet to `docs/index.html`,
publish it, verify a pageview/product click and prepare the Build 2 evidence. He
explicitly said **do not push to Heroku yet**. This supersedes the initial exclusion
of marketing-page measurement; it does not revoke app consent/redaction safeguards.
The existing v49 app/configuration remains unchanged by this update. Separate page
consent, opaque visitor identity and no replay are retained. See
`docs/BUILD2_SUBMISSION.md` for publication/check status and explicit evidence gaps.

## Project setup supplied by Jonas

- Project: [739580](https://us.posthog.com/project/739580/home), US Cloud.
- Organization: Minglo; project display name: Default project. Jonas reports the
  free tier and registration under his Stern email. These account settings have
  not been independently inspected from an authenticated session.
- Jonas supplied the public ingestion token in chat. It is not a personal API key;
  keep deployment configuration in environment settings, not this document. The
  public token is now configured only in Heroku environment settings.
- Jonas confirmed event retention is **Organization default (1 year)** under
  Project > Product analytics, and approved **ja5801@stern.nyu.edu** as the public
  privacy/deletion contact. The address belongs in Minglo's `/privacy` notice;
  it does not require a PostHog settings field.
- The app notice includes these details and is published in Heroku v46; its
  request-time status reflects the activation in v47. Muse's subsequent project
  report confirms IP discard, paused GeoIP, disabled replay/autocapture/web-vitals,
  UTC reporting and free/no-card status. Dashboard links are saved in the runbook.
- The notice-only update passed `npm run typecheck` and `git diff --check`.
  No app/database services were started and no analytics configuration changed.
- Do not add the default snippet to `docs/index.html`:
  that separate marketing page is outside the approved signed-in app scope.

| Batch | Status |
| --- | --- |
| PH0 | Project settings verified by Muse and relayed by Jonas: IP discard on; GeoIP paused; replay/autocapture/web-vitals capture off; one-year retention; free/no card; UTC. Deletion procedure documented. No separate $0 billing cap configured. |
| PH1 | Implemented: additive preferences, opaque identities, typed contract and loopback-only transport. Typecheck and two focused foundation cases passed on disposable PostgreSQL. Stable SDKs pinned: posthog-js 1.450.0 / posthog-node 5.74.0. |
| PH2 | Implemented. Production build/typecheck and three SDK mock-browser cases pass: sanitized pages, cross-tab withdrawal/account switching, and agent authorization/disconnect/reclaim. The user approved continuing after the two-failed-fixes pause. Required public token retained; SDK bot filtering disabled for authorized agent browsers; local collector accepts the test helper’s synthetic router header. |
| PH3 | Implemented: committed onboarding/social/conversation/routine events, retry deduplication, consent revisions and owner observations. Final validation is recorded below. |
| PH4 | Muse reports all three dashboards created with production filters/person-agent splits; links saved in the dashboard runbook. Repeat-interest cohort awaits real events; full saved insight semantics still need inspection. |
| PH5 | Code deployed v46 from `c9e3d8e`; capture enabled v47 and restored v49 after temporary disable v48. Muse verified two real opted-in browser events and redaction. Final health/active privacy passed. Full hosted kill-switch observation was ended at Jonas's request; local kill-switch tests passed. |

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

## Approved activation — Heroku v47

- Muse's settings report, relayed by Jonas, confirmed all requested project
  privacy controls, including the final web-vitals autocapture sub-toggle after
  reload. Reporting timezone is **UTC**. Retention remains one year, the free
  plan has no card, and the cycle runs to December 15. A separate $0 billing
  limit was not set because the UI required a card; no cap/alert is invented.
- Three dashboard URLs are saved in `docs/MINGLO_POSTHOG_DASHBOARDS.md`. Muse
  reports production filters and person/agent splits. Tiles remain sample/empty;
  the repeat-interest cohort needs actual events. These are project-side reports,
  not independently authenticated Codex reads or proof of live ingestion.
- Config-only **v47 succeeded** on the existing v46 application. Heroku has
  `POSTHOG_ENABLED=true`, `POSTHOG_TRANSPORT=cloud`, the exact US ingestion host,
  the supplied public token and `POSTHOG_ENVIRONMENT=production`. No account's
  preference, session secret, domain setting, Topics flag or paid resource changed.
- Health returned 200 / `{"ok":true}`; `/privacy` returned 200 with active status,
  one-year retention/contact and no-store. Anonymous eligibility remains 401/null.
- Six hosted anonymous privacy renders in both themes at 1440/390/320px passed
  with no overflow, page errors or PostHog requests while production was enabled.
  The browser was closed; local services remain off. Evidence:
  `.local/posthog/activation-hosted-live.json`.
- Jonas was asked to opt his own human account in, save and open Home. Muse
  should inspect the actual `page_viewed` event and report sanitized properties,
  then keep the Minglo tab open for the coordinated live disable/restore check.
  This user action/result is pending; do not claim PH5 fully verified yet.

## Live ingestion and final release — Heroku v49

- Muse reported creating a dedicated owner verification account, explicitly saving
  its opt-in in Account settings and opening Home twice. Two real `page_viewed`
  events arrived in US project 739580. No synthetic SDK post or social activity
  was generated by Codex. The test handle and opaque UUID are not saved here.
- Muse inspected `page_name=home`, `environment=production`, `account_type=person`,
  `capture_source=browser`, `schema_version=1` and `$geoip_disable=true`. Identity
  was an opaque UUID; no names, handles, raw URLs, chat text, IP or location fields.
  This is relayed authenticated Muse evidence, not independent Codex project access.
- PostHog's Events tab showed these actual events while the live stream still said
  it was waiting. Sample rows or a waiting stream alone are not ingestion evidence.
- Temporary disable produced successful config-only **v48**. Jonas ended further
  manual observation and requested completion. Codex restored capture as successful,
  current **v49**. No more manual check is requested. The full authenticated hosted
  kill-switch observation was not completed; its local lease/eligibility tests pass.
- Final v49 health returned 200 / `{"ok":true}`; `/privacy` returned 200 with active
  optional-analytics status. Source remains `c9e3d8e`. No preferences, token, session
  secret or paid resource changed. No source correction or new build was needed.
- Evidence: `.local/posthog/live-kill-disable.log`, `live-kill-restore.log` and the
  relayed Muse report in this conversation. Local services remained off.

## Remaining work and limits

- Latest live recheck after Muse reported an empty feed: Heroku v47 is current
  and succeeded; Cloud configuration is enabled with the US host, valid-format
  public token and production label. Health and active privacy status passed.
  A read-only aggregate query returned **0 saved AnalyticsPreference rows / 0
  enabled preferences** at that check. No account opt-in had persisted, so an
  empty project is expected. Jonas was directed to save his own human preference
  in Account settings and then open Home; if he already attempted that, inspect
  the save result before assuming an ingestion defect. No preferences were changed
  by Codex and no synthetic event was sent.

- Project details/settings/dashboard links have been supplied through Muse, not
  independently inspected by Codex. Existing privacy decisions and activation
  approval must not be asked again.
- Production code deployment/configuration and real browser ingestion are verified.
  Production server-event delivery and autonomous agent activity were not exercised
  by the two Home visits. No paid resource, credential rotation or social activity is
  authorized merely to populate charts.
- The production adapter accepts only the exact US ingestion host with an explicit
  Cloud transport, production environment, Heroku dyno, valid public token and
  existing session secret. Mock capture still rejects remote hosts and dynos.
  All local suites remain isolated and must never use the real token.
- Muse was asked to exclude the verification UUID using an internal-test cohort on
  all three dashboards; completion is unconfirmed. Do not export its handle as an
  analytics property. No further manual kill-switch check is requested.
- Add the repeat-interest cohort after events exist, and compare all saved insights
  against the dashboard specification (including schema-version filtering). No
  dashboard is claimed to contain real data until its events are inspected.
- Collection is best effort and excludes opted-out accounts; dashboards must show
  coverage/cohort limits. Existing no-backfill and separate human/agent identity
  rules remain. Analytics does not prove personal-agent autonomy.


## Build 2 Product Page publication

Jonas authorized Christian's Product Page follow-up and explicitly prohibited a
new Heroku push. Branch `feature/product-page-posthog` includes focused source,
test (`0cac0ca`) and documentation commits; merge `4f8d8a7` published successfully
through GitHub Pages. See `docs/BUILD2_SUBMISSION.md` for the final record and
remaining external evidence. No Heroku or database mutation occurred.

Nine focused real-SDK cases, typecheck, JavaScript syntax, formatting and diff
checks passed. The actual published page stayed quiet before consent; a controlled
verification visit and real Open Minglo click each received HTTP 200 from the US
project ingestion endpoint. Full pageview payload and the captured click callback
matched the redacted contract. Browser diagnostics established that Beacon body
visibility caused the initial verifier failure; both requests had succeeded.
No SDK safeguards were removed. The published-page screenshot is genuine public
UI evidence, not an exported PostHog dashboard. Actual dashboard export, new-event
UI inspection, consenting human replay and personal budget/critique evidence remain
explicitly unverified. Replay stays off; the page does not record private chats.

## November 16 — approved API action and bounded replay extension

Jonas supplied the exact Build 2 rubric and explicitly approved GitHub profile
import and a separate safe recording demo. No Heroku deployment is authorized.

- `feature/github-profile-import`: optional fixed-host public GitHub lookup,
  projected name/bio preview, explicit draft application and existing Save flow.
  Username validation, session-based ten/15-minute limit, five-second timeout,
  32KB response bound, no credentials or OAuth. People and agents retain their
  existing own-profile authorization. Four focused service/browser cases pass.
- `feature/bounded-local-analytics`: named, explicit disposable-local Cloud mode,
  verification labels, coarse lookup/apply click categories and shared bounded
  recorder. Production Cloud guards and ordinary replay exclusions remain.
  Separate recording consent is per visit; all text/inputs/attributes are masked,
  scripts/images/hidden fields/embeds blocked, plugin/custom events dropped and
  private URLs denied. Local recording expires within one minute.
- `docs/build2-api-evidence`: real local action screenshots, sanitized wire proof,
  local setup, PRD cost/run and corrected submission status. A repeated-fixture
  restart assertion was corrected to require both account roles rather than
  exactly two matching accounts; all matched readers still undergo checks.

At 09:16 Eastern the real localhost workflow completed lookup/preview/apply/save
and retained the imported name after reload. The original introduction survived
GitHub's empty bio. Real pageview and both click requests received HTTP 200;
payloads excluded GitHub/profile content. Opt-out eligibility was null. Source
and verification record: `42d791b`, `docs/evidence/build2-local-api.json`.

194 distinct checks are covered (162 app, 16 analytics mock, 4 Topics-off,
12 Product Page), plus build/typecheck/syntax and both persistence restarts.
The initial full run had one Public chat time-budget failure; its isolated
unchanged recheck passed. Cold dev Topics-off navigation also timed out; all four
passed against the production build without weakened assertions. Temporary local
services are shut down. No schema/dependency or production database change.

The real project configuration was read without admin credentials at 09:24
Eastern: session recording was still disabled. Zero live snapshots or consenting
human sessions are claimed. Muse still needs the project-side replay change,
actual dashboard export and event/replay UI inspection. Jonas's actual prior
hours/tool invoices remain unreconciled; no fabricated values or testimonials.

Publication completed: branches pushed and merged with separate merge commits
`c626870` (GitHub import), `096d7ad` (bounded local analytics) and `732dc21`
(evidence/docs). GitHub Pages built `732dc21` successfully. Published API evidence
assets matched source bytes; a fresh published consent/pageview/product-click
check received two real HTTP 200 ingestion acknowledgments, with no page errors
or overflow at four widths. This is wire evidence, not authenticated PostHog UI
inspection. Read-only Heroku inspection still reports healthy **v49**; no deploy
or configuration change occurred. Local app/test/database services are off.
