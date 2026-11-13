# Clickable sidebar account identity

The user requested that the bottom-left avatar/name/account-role block open their
profile. Source commits `68f8904` and `6ff074b` change that block from a div to a Next Link targeting
`/profile`, with the tooltip **Open your profile**. Native link text retains the visible name and role as its accessible name. Avatar, name and role
are one click/keyboard target for both human owners and agents. It uses the
existing sidebar styles and native focus-visible behavior; mobile retains the
existing More → My profile destination.

## Local cleanup completed first

The primary checkout was fast-forwarded to GitHub main after verifying and
archiving nine older modified/untracked files. A SHA-256 manifest, original files,
binary patch and original branch/worktree references are saved in the ignored
`.local/cleanup/20261113T051429Z/` backup. The temporary stash was removed only after
verifying the file archive. 67 unused merged local branch labels were safely
pruned; GitHub branches, checked-out branches and verification checkouts remain.

The loopback-only development `minglo` database was backed up before applying its
one pending additive tutorial migration. It now has 21 migrations. Prisma Client
was regenerated and typecheck passed. Existing preview processes were retained.
No production database or GitHub branch was changed by the cleanup itself.

## Verification

- Typecheck and production build passed in the isolated checkout
  `/private/tmp/minglo-tutorial-20261112`.
- Ten supplemental production-browser journeys passed: owner/agent, light/dark,
  Enter activation and avatar clicks, plus the existing mobile profile menu.
  The account block remains at least 44px tall, keeps its layout, and has a visible
  keyboard focus indicator. Representative screenshots were inspected.
- The initial focus check used programmatic focus in pointer modality. The driver
  was corrected to use Tab/Shift-Tab before asserting focus-visible; application
  styles did not need a correction.
- Final normal suite: **145/145 passed**; separately served Topics-off:
  **4/4 passed**. Both production restart checks passed. No Playwright retries
  or skips. The ten supplemental journeys are separate from these 149 cases.
- The earlier full run was stopped for the native accessible-name refinement;
  the final full run and all final checks use the `title`/native-name markup.
- The concurrent product documentation/screenshots update `cc991b0` was
  preserved after verifying it changes no app, schema, test or build source.
  All 159 recorded source/schema/package hashes matched the final tested build.

The existing complete suite is served on isolated ports 3117/3118 using disposable
`minglo_tutorial_test` / `minglo_tutorial_off_test`; restart checks use 3117/3119.
Ignored copies adapt only fixed local origin port literals, preserving assertions,
selection, browser and retry policy. No new committed test mirrors this simple
link change. Supplemental fixtures are local only.

Evidence: `.local/sidebar-profile-link/` contains build/typecheck logs,
`link-checks-final.log`, `link-checks.json`, `captures/`, `full-final.log`,
`topics-off.log`, `restart.log` and `topics-restart.log`.

## Release

Pre-release backup b021 completed. This change has no schema/dependency addition.
All required checks passed. The change is ready for the established merge and deployment workflow.
