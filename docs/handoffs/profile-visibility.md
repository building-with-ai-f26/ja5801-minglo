# Profile visibility wording — November 13, 2026

The owner reported that the signed-in-only visibility notice sounded like a
restriction hiding bios and interests while viewing another account. The profile
query already returns the saved public bio and interests for both people and
agents to every authenticated viewer. Missing-field placeholders represent empty
saved values; no ownership, follow or chat relationship is required to read them.

The public profile now says **This profile is visible to everyone signed in to
Minglo.** Empty fields explicitly say that the account has not added an introduction
or interests yet. The autonomous-work disclaimer is kept on agent profiles;
human profiles retain only the approximate-activity explanation.

The existing profile tests now verify that a person can read another agent's bio
and interests, and that independently signed-in person and agent accounts can
read a human's saved bio and interests. The existing agent-to-agent journey now
explicitly checks its bio. Profile edit access remains self-only. No schema,
profile query, authentication or private-conversation access rule changed.

## Verification

- Typecheck and diff checks passed before the release checks.
- Full development suite: 144 passed; the existing public-chat journey reached
  the 45-second test limit while creating its third browser page, after its
  posting, live-update and private-history checks. Its test and timeout were not
  changed. The profile-specific checks all passed in this run.
- Topics-off development suite: three passed; its existing agent sign-in journey
  timed out. Both timed-out journeys then passed unchanged against the production
  build (public chat 10.7s; Topics-off agent 16.0s). No assertion, timeout or app
  behavior was modified for those retries. All **149 distinct existing checks**
  completed across the initial runs and these two production retries.
- Production build and typecheck passed. Both production restart checks passed.
  The legacy restart initially rejected the four public-chat fixture accounts
  created by the original run plus retry because it expects exactly two. An
  ignored copy expects exactly four and exercises all four accounts with all
  remaining assertions intact; committed scripts are unchanged. Topics restart
  was rerun with its required explicit disposable TEST_DATABASE_URL after the
  initial invocation omitted that variable.
- Temporary production browser: saved human/agent bios and interests are visible
  to another signed-in person at 1440/390/320px; accurate empty states, no horizontal
  overflow or browser page errors. Representative mobile and desktop screenshots
  inspected. Independent person/agent readers were also verified by the existing
  profile test above.
- Pre-release backup **b022** completed. No schema or environment changes.
- Source `251d738`, merged as `081a56a`, deployed successfully as **Heroku v42**.
  Heroku build and release passed; 21 migrations were found with none pending.
  Canonical `https://www.minglo.club` database health, anonymous profile sign-in
  continuation and signed-out Public chat API denial passed. Authenticated
  production profile reads were not impersonated; cross-account reads were
  verified locally against the production build. The only runtime change from
  v41 is the profile copy in `src/app/profiles/[handle]/page.tsx`.
- Ports 3002/3003/3004/3100/3105/3106/3117/3118/3119/55432 were all closed after
  verification. The local database data remains intact. No persistent local
  preview, database or browser was left running.

Evidence is saved in ignored `.local/profile-visibility/`. Temporary local test
services are stopped after verification; the user's Heroku-only idle preference
is preserved. No production accounts, posts or profile details are fabricated.
