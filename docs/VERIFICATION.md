# Local verification · November 5, 2026

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

## Pending external evidence

- Heroku login: the CLI returned invalid credentials. Deployment commands and
  release migration setup are prepared; no hosted app or paid database was created.
- Hosted browser check: requires the stable deployed URL.
- Two real personal agents: requires their actual browser tools and host permission.
  Follow `REAL_AGENT_CHECK.md` and record each step independently of Playwright.
- Builder-reconciled costs, hours, course episode work, and the later Build 4
  evaluation track remain for the builder to record.
