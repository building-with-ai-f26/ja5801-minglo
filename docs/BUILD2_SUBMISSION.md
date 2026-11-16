# Build 2 — submission and evidence

Due **Monday, November 16, 2026 at noon Eastern**. Updated November 16.

- Product Page: https://building-with-ai-f26.github.io/ja5801-minglo/
- Live app: https://www.minglo.club/
- Repository: https://github.com/building-with-ai-f26/ja5801-minglo
- [Product requirements v2](PRD_V2.md)
- [Implementation and release history](handoffs/posthog.md)

## Scope of this update

Christian asked for the full PostHog web snippet in the Product Page head,
publication, real pageview/button-click verification, a consenting session-replay
check and a dashboard screenshot. Jonas authorized the work and GitHub publishing,
with **no new Heroku push/deployment**. The app's existing live configuration stays
unchanged.

## Exact rubric supplied by Jonas — November 16

The full assignment explicitly requires:

1. One complete user action working on the laptop with a real **AI or API** call,
   shown on the Product Page in a screenshot or recording.
2. PostHog on both Product Page and **local app**, showing pageviews, clicks and
   session replay.
3. PRD v2 covering biggest risk, how this build tests it, architecture and cost/run.
4. AGENTS.md covering project structure, setup and run commands.
5. Commits on two separate days outside class and a build log with progress,
   lessons, problems, costs and hours.

This supersedes the earlier syllabus-only interpretation. A direct model API is
not mandatory because the rubric says AI **or** API. PostHog is an actual API, but
we have not treated analytics-only capture on the published site as proof of a
complete local product action with a real external API.

| Exact requirement | Evidence / remaining gap |
| --- | --- |
| Local complete action with real AI/API call + image | **Verified November 16:** real public GitHub lookup → preview → apply to draft → Save → reload. Database checks confirm preview/apply did not persist and Save did. Genuine [preview](images/build2-github-preview.png) and [saved](images/build2-github-saved.png) screenshots are included on the Product Page. Disposable account and browser automation are disclosed. |
| Product Page + local-app PostHog | Published-page capture has real accepted requests. The new named `cloud-local` mode preserves production guards and requires explicit disposable-local setup and consent. The actual localhost demo emitted `page_viewed` plus both `ui_action_clicked` categories; real ingestion requests received HTTP 200. [Sanitized record](evidence/build2-local-api.json). |
| Pageviews, clicks and replay | Real pageview/click requests accepted on both surfaces. The approved local recording produced a masked snapshot with HTTP 200. Muse confirmed actual playback: 2 seconds, 4 clicks, 2 keys; viewport paints, all text/inputs remain masked. Same-tab opt-out was checked after 65 seconds; a further tracked click sent no new events and eligibility returned null. [Live record](evidence/build2-live-replay.json). Automated technical demo; no human usability study is claimed. |
| PRD v2 | Risk/architecture and estimate basis are documented. The real-host return risk remains partly untested; cost/run must distinguish variable API cost, fixed hosting allocation and unreconciled actual spend. |
| AGENTS.md | Structure, install, database, migration, run and verification commands are present, with [local real API/capture setup](BUILD2_LOCAL_DEMO.md) and the approved bounded replay exception. |
| Commits on two non-class days | **Met:** Friday Nov 13 (`361d336`, profile follow counts) and Sunday Nov 15 (`377b125`, guarded Cloud analytics), verified from Git dates in America/New_York. |
| Build log | Progress, lessons and problems are published. Actual coding costs, invoices and hours still require Jonas; no personal records are invented. |

No new Heroku deployment or configuration change is authorized by this follow-up.
Jonas explicitly approved the GitHub import and bounded replay demo on November 16.
Independent documentation/cadence verification is complete; missing personal and
authenticated project evidence stays labeled.

## Evidence checklist

| Requirement | Current evidence / limitation |
| --- | --- |
| Full web snippet in Product Page head | Complete PostHog bootstrap and initialization use the existing public project token and US host. SDK version 1.450.0 is pinned; the SDK waits for this page's own opt-in. No personal API key is included. |
| Product Page published | Published from merge `4f8d8a7`; GitHub Pages build succeeded. The live head/bootstrap and opt-in controls were exercised on the published URL. |
| App configuration and activation | Already complete before this update: app source `c9e3d8e`, active Heroku v49 after approved activation. Safeguards remain. No Heroku mutation is part of this task. |
| Real app page events | Muse inspected two opted-in Home `page_viewed` events in US project 739580. Expected production/person/browser/schema/GeoIP fields matched; identity was opaque and private fields were absent. This is relayed Muse evidence. |
| Product Page view and button click | Both events exercised on the actual published page using explicit consent and `environment=verification`; both real ingestion requests received HTTP 200. PostHog UI inspection of these new events remains pending. Isolated tests separately inspect complete outgoing payloads. |
| Session replay with consent | **Verified:** explicitly authorized automated local demo; real snapshot accepted, and Muse inspected actual masked playback. Two-second duration is disclosed. No human usability trial is claimed. |
| Dashboard screenshot | **Jonas confirms he has the actual screenshots for submission.** No image/link was supplied to Codex, so the export is not embedded here. Attach the screenshot to the hand-in. Muse reported 9 active users, 4 sessions and 9 pageviews; these are analytics labels and can include verification/anonymous identities, not nine proven distinct people. |
| Costs, hours, podmate critique | Actual invoices/coding-agent spend/hours require Jonas's reconciliation. Podmate sign-off is not in the exact five-item rubric supplied November 16 and is not treated as a separate submission blocker. No values or participation are fabricated. |

## Where to inspect

Project [739580 — US Cloud](https://us.posthog.com/project/739580/home):

- [Getting started](https://us.posthog.com/project/739580/dashboard/2360739)
- [Conversations and returns](https://us.posthog.com/project/739580/dashboard/2360762)
- [Owner interest](https://us.posthog.com/project/739580/dashboard/2360780)

Muse reported production filters, person/agent splits and UTC reporting. The
verification owner must be excluded through its opaque analytics ID. Completion
of that cohort exclusion and the repeat-interest cohort remains unconfirmed.
The Product Page has `surface=product_page`, with no person/agent account identity.
Use a separate insight for its two event names; never merge it into account funnels.

For a controlled published-page check, open the Product Page with
`?minglo_analytics_test=1`, explicitly allow page analytics, and click **Open Minglo**.
Those events are labeled `environment=verification` and excluded from dashboards
filtered to production. The query and fragment are never sent. Ordinary consented
visits use `environment=production`. No app account or social activity is needed.

The exact payload keeps the public project token, opaque per-document identity,
GeoIP-disable flag, fixed public canonical URL for `$pageview`, schema version,
environment, source and surface. A click adds only the fixed button/placement.
Ordinary page analytics excludes actual URLs, referrers, searches, text, recordings
and person properties. The separately consented recorder has its own opaque ID
and narrow safe-page contract; ordinary app recording remains disabled.

A successful browser capture request shows transport acceptance. The Events tab
in PostHog must show the event before claiming actual ingestion. In the earlier
Muse check, the live stream still said it was waiting while Events contained the
real app records; sample data is never counted as evidence.

## Bounded replay and remaining live check

Private conversations and sensitive inputs are excluded from recordings. The
approved implementation can start a separate recorder only on the canonical
public Product Page or exact disposable localhost demo, after additional per-visit
consent. It masks all text, inputs and attributes; blocks scripts/images/hidden
fields/embeds; drops plugin/custom events; and stops on withdrawal, tab switch,
leaving or expiry. Ordinary app analytics never enables its recorder.

The first local run at 09:16 Eastern had no snapshots because project-side replay
was disabled. At 10:31 Eastern the public project configuration showed replay
enabled, with URL triggers and autocapture opted out. A fresh explicitly approved
local demo at 10:33–10:34 started recording and its masked snapshot received HTTP
200. The same tab remained open for 65 seconds after opting out; a further tracked
click produced no new events, and session-derived eligibility returned null.
The [original recording-status screenshot](images/build2-live-replay.png) and
[sanitized wire record](evidence/build2-live-replay.json) are genuine evidence.

Muse subsequently inspected actual playback: two seconds, four clicks and two
keys; frames paint and all text/inputs remain masked. Jonas confirms he has the
real dashboard screenshots and can attach them directly to the submission. No
image/link was supplied to Codex, so the export is not embedded on this page. The
demo was authorized by Jonas and automated. The rubric does not separately ask
for a human usability study; no such study is claimed. Do not create production
registrations or agent connections merely to fill funnels. Verification events
are labeled separately, so empty production funnels can be expected. No admin
key is needed in the app or Product Page. No Heroku setting/account was changed.

## November 16 local action evidence

Source `42d791b`, production build, isolated loopback database ending `_test`,
`cloud-local` verification mode, actual public `GET /users/octocat`, no API/mock
overrides. GitHub returned “The Octocat” and no public bio; the original synthetic
introduction was preserved. Only Save updated the database and reload retained it.
Browser requests accepted a redacted profile pageview and lookup/apply clicks
with HTTP 200. Opt-out was saved and the eligibility endpoint returned `null`.
The demo browser closed and the local Next server was stopped after capture.
This is technical integration evidence, not agent autonomy or a human usability
study. No GitHub key, model API or paid resource was used. Direct API charge: $0.

## Checks and publication record

### November 16 API and bounded-replay extension

- **162 distinct app checks covered:** 161 passed in the full production-build
  run; the remaining Public chat journey hit its global time budget at the last
  read while the separate demo was also running. It passed alone in 18 seconds
  with the same assertions and 45-second limit. No app correction was needed.
- **16 analytics mock checks passed** with the official browser/Node SDKs.
- **4 Topics-off checks passed** against the production build. The initial cold
  development-server pass had a navigation timeout; assertions and limits stayed
  unchanged for the production recheck.
- **12 Product Page checks passed**, including the real recorder, content/attribute/
  script masking, separate consent, withdrawal and unsafe-URL exclusions.
- Production build, typecheck, script syntax and diff checks passed. Both real
  restart checks passed against preserved disposable fixtures. The restart
  verifier now accepts repeated Public chat fixtures while still requiring both
  account roles and checking every matched account before/after restart.
- **194 distinct browser/domain checks** across these suites. Rechecks and
  restarts are described separately, not counted as extra distinct cases.
- No new schema/dependency, production database mutation or Heroku push. Temporary
  demo/test servers and the isolated PostgreSQL cluster were shut down.

The historical November 15 publication/check record follows.

Publication of the November 16 extension completed from main merge `732dc21`:
GitHub Pages reported **built**, with no build error. The three source/evidence
branches were pushed and merged separately (`c626870`, `096d7ad`, `732dc21`).
The published page shows the real API section; both original screenshots, the
shared replay module and sanitized JSON returned HTTP 200 and matched local
bytes. A fresh consented verification visit to the actual published page emitted
the redacted `$pageview` and `product_button_clicked`; both received real HTTP
200 acknowledgments. Desktop/768/390/320px checks found no horizontal overflow or
page errors. No replay was started during that publication check. Authenticated
project UI inspection/dashboard export and human replay remain pending.

Heroku was inspected read-only afterward: **v49**, succeeded, created November 16
03:35:51 UTC. It was not deployed or reconfigured by this update. Local app/test
servers and the isolated PostgreSQL cluster are stopped.

Nine focused real-SDK browser cases passed. They cover no request before consent,
refusal, sanitized pageview/click, withdrawal/reload, cross-tab withdrawal, withdrawal
during SDK loading, blocked SDK, JavaScript disabled, unavailable storage and
responsive/keyboard controls. Four widths (1440/768/390/320px) had no horizontal
overflow; button targets were at least 44px. Representative original screenshots
were inspected. Typecheck, JavaScript syntax and `git diff --check` passed.

An initial no-JavaScript assertion targeted a `noscript` element that the Chrome
execution-disable emulation did not render. The corrected case verifies the
visible off status, disabled controls, functional product navigation and zero
third-party requests; no assertion timeout was increased.

Local Product Page checks require neither a database nor a Next.js server:

```sh
npx playwright test --config=playwright.product-page.config.ts
```

They intercept all ingestion and use the installed pinned SDK. The ordinary app
suite does not include them and its 176-case historical evidence is not rerun or
recounted as fresh Product Page evidence.

## Published-page verification — November 15

- Source merge `4f8d8a7` published successfully through GitHub Pages (`main` → `/docs`).
  The full head bootstrap loads pinned SDK 1.450.0 only after a page-specific opt-in.
- A controlled automated browser explicitly allowed analytics on the published
  `?minglo_analytics_test=1` URL, then opened Minglo through the actual product CTA.
  No third-party request occurred before consent. Real `$pageview` and click
  capture requests each received HTTP 200; both were labeled verification.
- The pageview was inspected from the browser request body; the click was observed
  through the real SDK's captured-event callback and its Beacon acknowledgment.
  Chromium's request observer did not expose the Beacon body, which caused the
  first verifier assertion to fail despite a successful send. Diagnostic evidence
  confirmed the request/callback and both HTTP acknowledgments. No tracking code
  was relaxed to address that verifier limitation.
- The real CDN SDK and installed test SDK had identical SHA-256 hashes. Four
  published viewport checks passed with no overflow or page errors; no replay,
  flags or recorder requests were observed. The browser was closed afterward.
- [Published-page screenshot](images/product-page-analytics.png) is genuine public
  browser evidence, **not a PostHog dashboard screenshot**. The dashboard export
  and authenticated inspection of these new Product Page records remain pending.
- No Heroku push, release, config change or database change occurred in this task.
  The prior app activation and two Muse-inspected Home events remain valid evidence.
- Ignored evidence: `.local/build2/product-tests.log`, `typecheck.log`,
  `live-page.json`, `live-diagnostic.json` and `published-*.png`.
  These contain transport/verification results, not a consenting-human replay.

## Personal review before hand-in

The Product Page contains a Build 2 log and links to PRD v2. Its architecture
explanation is prepared for Jonas to review; it is not evidence that a tutoring
exercise or episode was completed. Reconcile actual spend/hours, attach the genuine dashboard screenshot, and retain
the explicit replay
exception if a consenting recording is unavailable. No Icerynk submission, email
to Christian or other outbound message has been sent by this coding session.
