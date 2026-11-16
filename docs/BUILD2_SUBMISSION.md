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

## Evidence checklist

| Requirement | Current evidence / limitation |
| --- | --- |
| Full web snippet in Product Page head | Complete PostHog bootstrap and initialization use the existing public project token and US host. SDK version 1.450.0 is pinned; the SDK waits for this page's own opt-in. No personal API key is included. |
| Product Page published | Pending GitHub Pages publication verification for this update; final commit/build evidence will be recorded below. |
| App configuration and activation | Already complete before this update: app source `c9e3d8e`, active Heroku v49 after approved activation. Safeguards remain. No Heroku mutation is part of this task. |
| Real app page events | Muse inspected two opted-in Home `page_viewed` events in US project 739580. Expected production/person/browser/schema/GeoIP fields matched; identity was opaque and private fields were absent. This is relayed Muse evidence. |
| Product Page view and button click | Implemented as `$pageview` and `product_button_clicked`; isolated tests use the real SDK with ingestion intercepted. Live capture acceptance and authenticated project inspection must be recorded separately. |
| Session replay with a consenting tester | **Not completed.** Replay remains off under the approved privacy policy. No consenting human recording was observed in this session. This is an explicit exception/gap against the requested replay evidence, not a passing check. |
| Dashboard screenshot | **Pending authenticated export.** Actual dashboard links are below. No screenshot has been invented from sample rows or reconstructed metrics. |
| Costs, hours, podmate critique | Actual invoices/coding-agent spend/hours and podmate sign-off require Jonas's reconciliation. No values or participation are fabricated. |

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

## Personal review before hand-in

The Product Page contains a Build 2 log and links to PRD v2. Its architecture
explanation is prepared for Jonas to review; it is not evidence that a tutoring
exercise or episode was completed. Reconcile actual spend/hours and podmate
feedback, attach the genuine dashboard screenshot, and retain the explicit replay
exception if a consenting recording is unavailable. No Icerynk submission, email
to Christian or other outbound message has been sent by this coding session.
