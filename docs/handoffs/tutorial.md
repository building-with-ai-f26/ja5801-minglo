# Tutorial implementation progress

Approved scope: `docs/MINGLO_TOUR_PLAN.md`, T1 → T2 → T3. The user separately
approved deployment after implementation. Tutorial source `707d1a6` is live as
Heroku v36; see the deployment record below.

## Checkout and ownership

- Isolated checkout: `/private/tmp/minglo-tutorial-20261112`, starting at `a231a39`.
- Shared root has active theme edits in DESIGN.md, layout.tsx, theme-toggle.tsx
  and themes-shell.spec.ts. Preserve them; no root source/build/database changes.
- Tutorial owns its new domain/actions/components/tests, additive schema changes,
  shell anchors/replay entry, guide/settings integration and scoped documentation.
- Sequential implementation, no additional agents or worker terminals.

## T1 — complete

Add account-scoped state, atomic first-offer claiming, registration initialization
and authenticated strict-input actions. Existing accounts remain manual-only.
Typecheck passed. Four domain cases passed against disposable
`minglo_tutorial_test` using the isolated dev server; no retries. The first
local-cluster setup was sandbox-limited; the existing loopback PostgreSQL
instance is used with dedicated disposable databases instead. No production DB
or shared app database was changed.

T1 commits: `1d6014e`, `f642c0b`, `3183f49`; merged as `1d11396` and pushed.
The completed concurrent theme change `1beeaad` was already on origin/main and
was included when creating the integration branch, with no overlap/conflict.

## T2 — complete

One accessible native-dialog walkthrough engine, six steps per role, stable nav
anchors, optional inline first-use offer and More replay. Missing targets fall
back to an unanchored panel. Both complete journeys and account-scoped persistence
passed. Four domain and four browser cases passed; after adding mobile completion
and captures, all four browser cases passed again. Desktop owner and 320px agent
captures were inspected; controls/copy fit. Typecheck passed before the captures.
T3 will broaden themes, keyboard, failure and release verification.

## T3 — complete

Settings toggle/replay and the server-rendered six-step guide are implemented.
Settings success/failure/retry, session-derived action identity, forged actor and
anonymous rejection, and both roles' no-JavaScript guides passed. Typecheck passed.
The new additive migration was applied to a disposable database at the previous
schema: its existing account and synthetic saved history were unchanged, and no
existing account was enrolled (`.local/tutorial/migration-preservation.log`).

The first broad run found two independent issues: More obscured primary targets
on mobile; native-dialog keyboard traversal could leave the controls at a Tab
boundary. The More correction passed its assertions in the next run. Settings
tests originally used synchronous checkbox `check()` despite waiting for server
persistence; corrected to click plus explicit saved-state assertions, all passing.
Automatic approval review rejected the first proposed keyboard edit as a third
accessibility fix attempt. The edit stayed paused while independent migration,
Topics-off and build checks continued. The user explicitly approved “Apply the
focus correction and continue.” The approved Tab/Shift-Tab wrap was then applied.
All four production accessibility/cleanup cases passed: both complete role tours
at 320/360/1440px in both themes, 200% layout equivalents, reduced motion, failed
automatic offer, route departure and account switching. The original uncorrected
full run was interrupted after approval so final checks use the corrected build.
Full release checks are now complete; see the verification record below.

Deployment was subsequently approved and completed; see the release record below.


## Final verification and delivery

T3 source/test commits: `c3d1511` (settings/plain guide), `7e03403` (menu and
save recovery), `aea0e5f` (approved focus wrap and responsive checks), `4c6f70d`
(Topics-off and restart coverage). The feature branch is `feature/tutorial-t3`;
merge commits into main preserve the three separate implementation batches.

| Check | Actual result / evidence in this isolated checkout |
| --- | --- |
| Final typecheck | Passed; `.local/tutorial/typecheck-final.log`. |
| Production build after approved correction | Passed; `.local/tutorial/build-after-focus.log`. |
| Complete normal test set | **141/141 passed**, no retries/skips; `.local/tutorial/full.log`. |
| Separately served Topics-off test set | **4/4 passed**, no retries/skips; `.local/tutorial/topics-off-final.log`. |
| Main production restart | Passed, including tutorial completion/preference persistence and existing social/security state; `.local/tutorial/restart.log`. |
| Topic production restart | Passed; `.local/tutorial/topics-restart.log`. |
| Existing-schema migration preservation | Passed on dedicated `minglo_tutorial_migration_test`; existing account/history unchanged, zero existing preferences backfilled; `.local/tutorial/migration-preservation.log`. |
| Supplemental welcome/settings/plain-guide captures | Passed; `.local/tutorial/help-visual.log` and `help-captures/`. Only disposable local fixtures. |
| Source freeze | All 22 recorded changed application/schema/test/script hashes matched after checks; `.local/tutorial/source-manifest.json`. |

**145 distinct automated cases passed.** Earlier focused runs are subsets, not
additional distinct cases. The production Playwright configs in `.local/tutorial`
import the stock configs, retaining the complete test sets, Chrome, single worker,
timeouts and reset guards; they change the server command to `npm start` and use
explicit checkout/output paths. This follows the installed Next.js testing guide.
The standard committed configs still use the documented dev-server workflow.
Dedicated loopback `_test` databases are `minglo_tutorial_test` and
`minglo_tutorial_off_test`; neither production nor shared development data was reset.
The full enabled fixtures were retained for the subsequent restart checks.

The full run captured 74 role/theme/viewport/step and layout-zoom images. Fourteen
representative final tour originals were inspected, spanning each role, both
colors, 320/360/1440px and both 200% layout equivalents. All six supplemental
welcome/settings/plain-guide captures were inspected as well. The first
supplemental theme captures caught a theme transition mid-frame; they were
recaptured with reduced motion to inspect settled colors. Earlier mobile
step-by-step captures were also inspected. No independent reviewer, physical-device,
actual browser zoom, screen-reader session or real-agent usability/autonomy trial
is claimed. At short/zoom-equivalent heights, panel text and controls remain
scrollable; these checks do not claim every background target remains unobscured.

A source review confirmed session-derived action identity, exact eligible routes,
no actor field, no production seed, no hidden social writes and no new dependencies.
The app tutorial keeps original privacy/claim approvals and host scheduling separate.

## Shared-checkout overlap and next action

During final verification, fresh uncommitted changes appeared in the shared root:
`src/app/for-agents/page.tsx`, `src/app/public-room/page.tsx`,
`src/app/public-room/public-room.css`, `src/components/app-shell.tsx`,
`src/components/composer.tsx`, `src/components/conversation-panel.tsx` and
`src/components/transcript.tsx`, plus generated `next-env.d.ts`. They are preserved
and excluded from this tutorial delivery. The shared root also retains the
original untracked planning copy. Do not reset or overwrite those changes.
In particular, the next session integrating that shell work must preserve the
merged tutorial provider, anchors and More replay entry. All tutorial work and
its build/test artifacts remain isolated at `/private/tmp/minglo-tutorial-20261112`.

The user then explicitly requested deployment. The Heroku push and additive
migration are complete. No domain/config/credential change, paid resource
provisioning or production fixture creation occurred. No build or deployment step
remains for T1–T3. Further real-user/host usability observation is separate.


## Heroku v36 deployment — November 12, 2026 (America/New_York)

- User explicitly authorized deployment after the completed implementation.
- Pre-release live baseline was v35 / `1beeaad`; GitHub main and the isolated
  tested source were `707d1a6`. The uncommitted shared Public chat work was excluded.
- **Backup b016 completed before release**, at 23:12:07 Eastern. No restore/reset.
- Deployed `707d1a6` to the existing `minglo-ja5801` app as **v36**. Heroku build
  and TypeScript checks passed. Release phase found 21 migrations and successfully
  applied only `202611130001_account_tour_preferences`; `web.1` is up.
- Canonical URL `https://www.minglo.club` passed the final anonymous Chrome smoke:
  database health, landing/default light theme, six authenticated page guards,
  three signed-out private API denials, the public guide/authenticated-tour
  separation and no browser page errors. An earlier smoke while release was still
  pending checked the previous healthy app; final evidence was rerun after v36
  succeeded (`.local/tutorial/hosted-smoke-final.log` and `hosted-smoke.json`).
- Existing accounts replay from **More → Take a tour**, How it works or Account
  settings; they deliberately do not receive a surprise welcome on release.
  Genuine new registrations receive the eligible one-time optional offer.
- Authenticated production tour completion was not exercised: no production
  accounts, messages or host tasks were created, and no user session was
  impersonated. Both role journeys and persistence passed locally against the
  same production source in the 145-case verification and both restart checks.
- Build/deploy and migration evidence: `.local/tutorial/deploy.log`,
  `deploy-backup.log` and `release-v36.log`. Release records do not change app
  source and require no additional deployment.
