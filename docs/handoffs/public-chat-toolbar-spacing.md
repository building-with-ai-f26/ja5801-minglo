# Public chat toolbar spacing

The user reported Browse topics / Signed-in accounts crowding the conversation
below. The toolbar introduced in `a4f76aa` had no bottom spacing. Application
commit `81c192c` adds `margin-bottom: 24px` to `.public-chat-toolbar` in
`src/app/public-room/public-room.css`, keeping the controls and conversation grid
as distinct groups at every supported layout.

The change was made in the isolated checkout
`/private/tmp/minglo-tutorial-20261112`, branch `fix/public-chat-toolbar-spacing`,
from GitHub main `a4f76aa` (live v37 at the start). Shared-checkout edits and the
other session's running server were preserved.

## Verification

- Typecheck and production build passed.
- A supplemental production-browser check measured exactly 24px below the toolbar,
  with no horizontal page overflow, in 24 combinations: owner/agent, light/dark,
  320/390/1440px and Topics enabled/disabled. Screenshots were inspected for both
  roles/themes and phone/desktop layouts. All fixtures were local/disposable.
- The first supplemental checks on the default port encountered sign-in timeouts.
  Read-only process inspection found another session's server on port 3100 from
  `/private/tmp/minglo-for-agents-release`. That server was left running. The
  supplemental checks passed on unused port 3117.
- The complete committed test set is being served on dedicated ports 3117/3118,
  with restart checks on 3117/3119. Ignored verification copies adapt only fixed
  local test-origin port literals. All 44 copied verification files match the
  committed originals after normalizing the port. Assertions, browsers, test
  selection, reset guards and retry policy are preserved. Production data and
  the other session's app/database are not used.
- Complete suite: **141/141 passed**; separately served Topics-off: **4/4
  passed**; both production restart checks passed. No Playwright retries/skips.
- While checks ran, the other session released `0c67f33`, adding a
  `public-page` wrapper to `/for-agents`. That change was merged as `f776aee`
  to preserve it. Post-integration typecheck/build passed, all 24 spacing
  combinations passed again, and all eight affected Public chat/theme cases
  passed on the combined production build. These eight are a subset of the
  145 distinct cases, not extra distinct coverage. The independent guide wrapper
  was checked on the combined build and retained its themed, non-overflowing layout.
  The complete suite/restart results precede this independent wrapper integration;
  the subsequent checks cover the combined rendering change.

Evidence lives under `.local/toolbar-spacing/`: `layout-isolated.log`,
`layout.json`, `captures/`, `typecheck.log`, `build.log`, `full.log`,
`topics-off.log`, `restart.log`, `topics-restart.log`, `port-adaptations.txt`,
`layout-integrated.log`, `focused-integrated.log`, `typecheck-integrated.log` and
`build-integrated.log`.

## Release

Standard pre-release backup b019 completed. No schema/dependency change is part
of this spacing correction. The final required checks passed. Merge/deployment follow the saved release workflow; the runtime diff from the already released `0c67f33` is only the single toolbar margin.


## Deployed release

- Merged and pushed the fix as `31884fd`; deployed it to the existing Heroku app
  as **v39** on November 12, 2026 (America/New_York). The previous live guide
  styling `0c67f33` is retained. The runtime change from that baseline is the
  single margin declaration.
- Backup b019 completed before release. Heroku build/typecheck passed; release
  found 21 migrations and none pending. `web.1` is up. No schema, credentials,
  domain settings or paid resources changed.
- Final anonymous smoke at `https://www.minglo.club` passed database health,
  default light theme, six sign-in guards, three signed-out API denials, guide
  separation, the preserved agent-guide wrapper and no browser page errors.
- The actual deployed stylesheet `/_next/static/chunks/2fl1eouvfkx8a.css`
  returned 200 and its `.public-chat-toolbar` rule contains
  `margin-bottom:24px`. This confirms the live CSS change without using a
  production account or reading conversations.
- Deployment/smoke evidence: `.local/toolbar-spacing/deploy.log`,
  `release-v39.log`, `hosted-smoke.log` and `hosted-smoke.json`.
  Refresh Public chat to load the new stylesheet. No build step remains.
