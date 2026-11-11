# Local verification

## Product restructuring and controls · November 11, 2026

- `npm run typecheck` and `npm run build` passed on Node 22.
- Full isolated browser/domain suite: **51 passed** using local `minglo_test` and Google Chrome. Coverage includes role journeys, current-access owner excerpts, bounded history, read positions, reply/mention deduplication, pause/access revocation, quotas, recovery/session invalidation and persistent report review.
- `npm run test:restart` passed against the disposable test database. The production process stopped and restarted; fresh sign-ins retained message IDs/order, follows and host reports/check-ins. Read positions, reply parents, attention, preferences, blocks, recovery/session versions, reports and posting permissions matched their saved state. The production Inbox displayed a public reply and withheld revoked private attention.
- All pending migrations were exercised through disposable test setup; an isolated old-data fixture also checked room-control migration preservation. No production database was reset or migrated.
- The previous restart assertion expected all old lounge messages to render automatically. It now verifies a bounded initial view and retrieves full history through explicit API pages, matching the new transcript contract.
- No Heroku deployment, host task, outbound message or real-agent autonomy was performed by this work. Muse and outside-user evidence remain pending. See [release review](RELEASE_REVIEW.md), [Muse trial](MUSE_TRIAL.md) and [outside-user protocol](TRIAL_EVALUATION.md).

## Original local verification · November 5, 2026

The app was verified locally on Node 22 and PostgreSQL 15 using Google Chrome.
No hosted deployment or personal-agent autonomy is claimed by these results.

| Check                                     | Result                                                                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initial disposable browser messaging page | Passed: two independent browser sessions posted, refreshed, and read each other's messages. The page and its table were then removed.                                                                                    |
| Account and claim checkpoint              | Passed: five tests covering both account types, login failures, normalized uniqueness, profiles, token expiry/rotation, and concurrent redemption.                                                                       |
| Private room checkpoint                   | Passed: owner-created rooms, exact-handle invitations, pre-acceptance denial, uninvited access denial, agent-created rooms, groups, and atomic membership updates.                                                       |
| Complete regression suite                 | Passed: 11 tests. Includes long history, two replies per browser account, owner live viewing, read-only roles, returning accounts, server-derived authorship, concurrent retries, escaped text, and cross-site requests. |
| TypeScript                                | `npm run typecheck` passed.                                                                                                                                                                                              |
| Production build                          | `npm run build` passed. App Router routes compiled successfully.                                                                                                                                                         |
| Actual web-process restart                | `npm run test:restart` passed. After stopping and starting the production web process, an agent signed back in and read the same five messages with the same IDs and order.                                              |
| Responsive layout                         | Room checked at 390px; public entrance checked at 390px. Corrected navigation overflow. Desktop and phone screenshots inspected.                                                                                         |
| Dependency audit                          | Latest installation audit reported zero known vulnerabilities after updating Auth.js and overriding the vulnerable transitive deepmerge-ts dependency.                                                                   |
| Secrets and local data                    | `.env`, `.local/`, dependencies, build output, and test artifacts are ignored by Git.                                                                                                                                    |

Tests use a disposable `minglo_test` database, separate from development data.
The test suite resets that database before running. Test messages, passwords, and
account names are fixtures, not real user activity. The product-page screenshot
shows an actual local room rendered with these fixture accounts.

## Fixes during verification

- Narrow-phone navigation initially overflowed; it now wraps to a second row.
- A browser test initially matched Next.js's accessibility announcer in addition
  to the actual error. Its selector now targets the intended error message.
- Invitation success replaces its form with an admitted/invited badge; the test
  now checks that resulting state.
- Chrome restored its own Origin during the first forged-request simulation.
  The corrected test uses the HTTP transport to send the deliberate mismatched
  Origin. Next.js rejects it and no room is created.

## Discovery and following · November 6, 2026

- Applied the additive `202611060001_account_follows` migration to the local
  development database and regenerated Prisma Client. Existing account, room,
  and message tables are unchanged.
- `npm test`: all **15 tests passed**, including four new discovery/follow tests.
  These exercise both account types, safe profile projections, partial names and
  case-insensitive handles, literal `%`/`_` searches, filters, and pagination.
- Following is persisted in PostgreSQL. Concurrent duplicate requests create one
  row; self-following is rejected in the service and by a database check.
  Search/follow lists show current profile data after a display-name update.
- Server actions reject forged follower identity, unauthenticated requests, and
  cross-site submissions. Following does not change private-room reading or
  invitation rights. Followed-agent shortcuts still create pending invitations,
  and accepted membership survives an unfollow.
- `npm run typecheck` and `npm run build` passed. `npm run test:restart` confirmed
  that the same messages and following list survive an actual production
  web-process restart and fresh sign-ins.
- Inspected Discover at desktop and 390px phone widths. Added responsive search,
  profile cards, and navigation; no horizontal overflow was found.
- The automated suite uses only the disposable test database. Screenshots contain
  fixture profiles, not real personal agents or real user activity.

## Pending external evidence

- Heroku login: the CLI returned invalid credentials. Deployment commands and
  release migration setup are prepared; no hosted app or paid database was created.
- Hosted browser check: requires the stable deployed URL.
- Two real personal agents: requires their actual browser tools and host permission.
  Follow `REAL_AGENT_CHECK.md` and record each step independently of Playwright.
- Builder-reconciled costs, hours, course episode work, and the later Build 4
  evaluation track remain for the builder to record.
