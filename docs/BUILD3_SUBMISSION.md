# Build 3 — submission package

Due **Monday, November 23, 2026, noon New York time**. Prepared November 22. Lane: **Beginner**. Nothing has been submitted to the course site by the agent.

The security package and tested fixes are authorized for publication and deployment. Live release verification is in progress. The security report describes the actual application access controls and remaining database RLS work.

## What to enter

**Link box:**

```text
https://www.minglo.club
```

**Submission note:**

```text
Minglo — Beginner lane.
Repository: https://github.com/building-with-ai-f26/ja5801-minglo
Security review: https://github.com/building-with-ai-f26/ja5801-minglo/blob/main/SECURITY.md

The attached live test shows Account A reading its private conversation and Account B being denied the same request. The app is hosted on Heroku with persistent PostgreSQL. PRD v3, the Build 3 log and deployment/approval rules are in the repository.

```

**Upload:** [build3-access-control.png](images/build3-access-control.png). This clearly labeled result report shows the live A=200/B=404 comparison. Also available: the [original blocked app page](images/build3-account-b-blocked.png) and [original blocked JSON response](images/build3-blocked-response.png). The report is generated from [actual sanitized results](evidence/build3-live-access.json), not invented UI or sample responses.

The remote SECURITY.md link will not work until the local files are committed and pushed. The product-page log likewise is not published yet. Do not submit a broken evidence link.

## Rubric checklist

| Requirement | Status |
| --- | --- |
| Public app and persistent database | Already live on Heroku v57; canonical HTTPS and live private workflow exercised. |
| Phone workflow | Automated 390 × 844 Chrome registration/sign-in/private-room/message/read passed; physical-phone check remains. Bring phone November 24. |
| RLS every table | Not enabled: 30 tables, zero RLS policies. Current server enforcement and future work are documented. [Decision and next batch](../SECURITY.md#rls-decision-and-remaining-work). |
| Account B cannot read Account A | **Passed live:** A=200/one message, B=404/no private content. Four additional adversarial checks also passed. |
| Repo/live key search | No confirmed usable credential exposures in the checked scope. One historical placeholder triaged. [Scan record](evidence/build3-secret-scan.json). |
| File storage privacy | No user uploads/buckets; public static product evidence only. |
| Production guardrails and manual backup | Shipping/Ask me first/real-mistake rules prepared in AGENTS. Manual backup b029 completed before this approved release. |
| Spending/rate limits | No Minglo model provider. Shared write guard and existing stricter quotas tested locally; deployment pending. Existing provider free-plan status is not a fresh billing audit. |
| Dependency audit | Local patch: effect 3.22.1; npm audit zero vulnerabilities. Deployment pending. |
| Agent security review and report | [SECURITY.md](../SECURITY.md), five actual live attempts and limitations documented. |
| PostHog/session replay | Existing consent boundaries preserved. See [new live evidence](evidence/build3-live-analytics.json); pageviews/snapshots accepted, but a click after replay stop was not observed and new dashboard playback was not inspected. Further live-check fixes stopped after two attempts. Earlier actual playback evidence remains dated Build 2. |
| PRD v3 | [Prepared](PRD_V3.md): hosting, DB, auth/security decisions, costs and remaining security work. |
| Commits on two days outside class | Existing Saturday Nov 21 `319eff0` and Sunday Nov 22 `48f180b`, checked in America/New_York. No backdating. |
| Build log | Product Page draft plus [working copy](../journal/build-03-build.md): shipped/learned/broke, ~8 hours, prior cost estimates explicitly carried forward. |

## Verification of the local release candidate

- New write-limit regression: **2 failed before the fix, 2 passed after**. Tests use real Server Action/JSON/OAuth routes against a disposable database; no production quota flooding.
- `npm audit --json`: **zero vulnerabilities** after the dependency override.
- `npm run build` and `npm run typecheck`: passed.
- **198 distinct automated checks passed:** 164 app tests (including the two new write-limit checks), 16 public-auth tests, 2 trial-auth tests, 4 Topics-off tests and 12 Product Page tests. App tests used the production build with auth disabled; the dedicated auth suite verified public/trial modes.
- Both production restart checks passed, preserving private/public/direct history and request/read state, plus topic creator/retry identity, messages, moderation and follows.
- The initial Product Page run had 11 passes and one test failure: its locator assumed one build-log section. Updating it to open all weekly sections preserved the layout assertions; all 12 passed on the recheck.
- Product Page log visually inspected at 1440, 390 and 320 px; no horizontal overflow. Temporary test servers and the task-started PostgreSQL cluster were stopped.
- Production build, typecheck, formatting and diff checks passed. The separate real-network analytics click-after-replay-stop check remains inconclusive; the local suite passing does not close that live limitation.
- Commands: `npm run build`, `npm run typecheck`, `npx playwright test --config=.local/auth-release/full.config.ts`, `npx playwright test --config=playwright.auth.config.ts` (public and `TEST_AUTH_ROLLOUT=trial`), the production Topics-off wrapper, both `npm run test:restart` / `npm run test:topics:restart`, and `npx playwright test --config=playwright.product-page.config.ts`. Local wrappers only replace dev with the production server and select isolated loopback `_test` databases; test assertions are unchanged.
- No migration, live permissions, credentials, paid resource or production configuration was changed for this audit. The two synthetic test accounts and their private fixture remain; no unrelated account data was accessed.

## Before submitting

1. Confirm the published security report and screenshot links below load before copying them into the course site.
2. On your phone, open the live app, sign in, open a conversation, send a message where you have posting rights, reload and verify it persists. No screenshot of private real-user content is needed.
3. Paste the live URL and note, upload the access-test image, and click the course site's final submission button. Attaching files alone does not submit.
