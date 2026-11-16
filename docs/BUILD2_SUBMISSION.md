# Build 2 — submission and evidence

Due **Monday, November 16, 2026 at noon Eastern**. Prepared November 15.

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
| Local complete action with real AI/API call + image | Local core workflows and UI fixtures have been tested; a local product action using a real external API and its corresponding image have not yet been demonstrated. An optional public GitHub profile import is proposed for Jonas's decision. |
| Product Page + local-app PostHog | Published-page capture is implemented and real requests were accepted. Current real app capture is Heroku-only; localhost uses the mock collector. A separate guarded local capture mode is still needed for this rubric. |
| Pageviews, clicks and replay | Pageviews/click capture have evidence as detailed below; session replay is off. The disclosed exception does not mean the replay check passed. A separate bounded, consenting-tester demo is proposed. |
| PRD v2 | Risk/architecture and estimate basis are documented. The real-host return risk remains partly untested; cost/run must distinguish variable API cost, fixed hosting allocation and unreconciled actual spend. |
| AGENTS.md | Structure, install, database, migration, run and verification commands are present. Local real-capture/demo instructions will need updating if implemented. |
| Commits on two non-class days | **Met:** Friday Nov 13 (`361d336`, profile follow counts) and Sunday Nov 15 (`377b125`, guarded Cloud analytics), verified from Git dates in America/New_York. |
| Build log | Progress, lessons and problems are published. Actual coding costs, invoices and hours still require Jonas; no personal records are invented. |

No new Heroku deployment or configuration change is authorized by this follow-up.
The new feature and replay boundary are material choices presented to Jonas;
independent documentation/cadence verification does not depend on those answers.

## Evidence checklist

| Requirement | Current evidence / limitation |
| --- | --- |
| Full web snippet in Product Page head | Complete PostHog bootstrap and initialization use the existing public project token and US host. SDK version 1.450.0 is pinned; the SDK waits for this page's own opt-in. No personal API key is included. |
| Product Page published | Published from merge `4f8d8a7`; GitHub Pages build succeeded. The live head/bootstrap and opt-in controls were exercised on the published URL. |
| App configuration and activation | Already complete before this update: app source `c9e3d8e`, active Heroku v49 after approved activation. Safeguards remain. No Heroku mutation is part of this task. |
| Real app page events | Muse inspected two opted-in Home `page_viewed` events in US project 739580. Expected production/person/browser/schema/GeoIP fields matched; identity was opaque and private fields were absent. This is relayed Muse evidence. |
| Product Page view and button click | Both events exercised on the actual published page using explicit consent and `environment=verification`; both real ingestion requests received HTTP 200. PostHog UI inspection of these new events remains pending. Isolated tests separately inspect complete outgoing payloads. |
| Session replay with a consenting tester | **Not completed.** Replay remains off under the approved privacy policy. No consenting human recording was observed in this session. This is an explicit exception/gap against the requested replay evidence, not a passing check. |
| Dashboard screenshot | **Pending authenticated export.** Actual dashboard links are below. No screenshot has been invented from sample rows or reconstructed metrics. |
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
It excludes actual URLs, referrers, searches, text, recordings and person properties.

A successful browser capture request shows transport acceptance. The Events tab
in PostHog must show the event before claiming actual ingestion. In the earlier
Muse check, the live stream still said it was waiting while Events contained the
real app records; sample data is never counted as evidence.

## Replay exception and safe next check

Private conversations and sensitive inputs are excluded from recordings. The
current implementation records no sessions anywhere. A later public-page-only
recording would require a separate explicit tester choice, all inputs/text masked,
network/console capture off, an isolated URL allowlist and an observed human
session. Do not claim an automated browser is a consenting outside tester.
No PostHog project replay setting was changed for this task.

## Checks and publication record

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
