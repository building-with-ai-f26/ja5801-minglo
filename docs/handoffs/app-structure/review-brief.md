# Independent app-structure review

Status: ready for a **new read-only review terminal**. A–D have completed implementation/verification; do not spawn replacements or resume their work without a concrete assigned finding. The coordinator has not performed this independent review. Do not deploy.

## Shared checkout and evidence baseline

Work in `/Users/jonasal-taher/code/Jonas-09/ja5801-minglo`, branch `feature/app-structure`. HEAD is `a73c2820221d37022b3067ad82c1bf0d78048346` plus uncommitted integrated app/test changes and coordinator documentation. Compare the working tree with implementation base `d5783d6` using read-only Git commands; do not pull, switch branches, reset, stash, stage, commit or push.

Read AGENTS.md, `docs/APP_STRUCTURE_PLAN.md`, `docs/handoffs/app-structure/coordinator.md` and final A–D reports. The approved scope/role/route decisions are settled. Read PRODUCT.md, DESIGN.md and the Home/Topics surface briefs for the retained Side by Side identity. Apply the existing Impeccable finish-review discipline to the changed UI alongside source/security review; this is an extension, not a new visual world.

## Actual verification already completed

- Default `npm test`: **115 passed**, zero skips, no configured retries. Two separate actual Topics-off browser cases passed. Fifteen focused read/UI cases also passed; these are a subset, not an additional 15 distinct default cases.
- Typecheck, production build and both legacy/topic production restart checks passed, with final full-suite fixtures retained.
- Supplemental production rendering: 72 page variants, no overflow/pageerror failures; both roles, 1440/360/320px and light/dark. Keyboard More/focus and synthesized Chrome touch checks passed; this is not a physical-device, screen-reader or exhaustive contrast audit.
- Earlier failures and first successful fixes are preserved transparently in D's report: action/navigation/hydration synchronization and closing More before topbar sign-out. No production file changed during D verification. The coordinator inspected the four test diffs; no security/history assertion, quota, timeout or required case was loosened.
- Coordinator independently matched all **53** verified-file hashes against the current tree and all **168** final original screenshot hashes against D's manifest before documentation-only updates. Application/test source is frozen after this verified snapshot. `next-env.d.ts` changed automatically to production type-reference paths during the approved build.
- Runner is released; no app listeners were found on the leased ports. Do not start new tests, app servers/builds, migrations, database resets or artifact generation. Use the existing evidence; request a specific additional check if the available evidence cannot support a conclusion.

## Review focus

1. Personal versus current-owner read-only rights, incoming/outgoing/observed request counts, cancelled history and participant precedence. Do not reopen the approved connected-owner DM visibility policy.
2. Selected **Agent row ID** ownership checks, empty/malformed/duplicate/bracket/unrelated/revoked filters, access predicates intersected with the filter, reader locks/current-access rechecks and retained independent unfiltered rights.
3. Home selection before bounded lists: older actionable personal requests survive more than 30 recent observed chats; groups stay disjoint, ordered and bounded. No implicit reads, subscriptions or changes to write/pause/moderation permissions.
4. Canonical Topics/temporary legacy redirects, actual server gate off, active keys, no blank mobile slot, role-correct destinations, own profile versus My agents and four distinct agent actions.
5. Sign-in allowlists, scalar query validation, preserved selected-agent context, archive/page resets and truthful shared pagination/group empty states.
6. Narrow-screen readability, More keyboard/focus/touch behavior, typography/attribution, both themes and the preserved pill/spacing/no-white-loading baseline. Check actual original captures before making visual claims.

## Evidence paths

All paths below are local and ignored; no credentials/private production content is included.

- Full actual verification account: `docs/handoffs/app-structure/worker-d.md`, final sections.
- Logs: `.local/app-structure/verification/d-run/01-typecheck.log`, `02-focused-fix1.log`, `03-topics-off.log`, `04-default-sync-fixes1.log`, `05-build.log`, `06-legacy-restart.log`, `06-topics-restart.log`, `07-rendered.log`.
- Original-capture/state/hash index: `.local/app-structure/verification/d-run/evidence-manifest.json` (`finalCaptures`, 168 originals).
- All 48 enabled/off navigation states have role/gate/theme/viewport/More metadata there. Contact sheets live under `07-review/nav-{OWNER,AGENT}-{on,off}-{light,dark}.png`, with ordering in `07-review/contact-manifest.json`; use these to orient, then inspect full originals for findings and required narrow/desktop states. Derived crops do not replace originals.
- Supplemental production originals: `07-rendered/{OWNER,AGENT}-{surface}-{1440,360,320}-{light,dark}.png`; `07-rendered/checks.json` maps the 72 routes/states and keyboard/touch results. Exact available surface names are in the manifest, not all Cartesian combinations exist. Both touch originals are separate.
- Preserved off originals: `03-topics-off-artifacts/`; passing default originals: `04-default-passed-artifacts/` and `04-default-passed-s7-captures/`.
- Source verification: `source-manifest-after-verification.json` (`hashes`, `changedSinceGrant`). Only four D-owned synchronization-test files changed during the lease; no `src/` production change.
- Source detector: `07-source-ui-detect.json`: 0 primary findings, 23 advisories corresponding to preexisting exact CSS lines. No second detector run is needed. Known stale design sidecar is documented, not automatically repaired.

## Known review item, not a settled verdict

D observed **mid-word wrapping at 320px** for Messages and Manage participation. Targets and content remain present and no horizontal overflow was detected. The coordinator saw this in the existing images and deliberately left source unchanged so the independent review can judge its severity. Decide whether a targeted fix is needed before ship; do not declare it resolved from test counts alone.

More overlays underlying content while open; the menu scrolls. The fixed test closes it before using the topbar. Review whether the delivered behavior meets this approved scope rather than treating a passing test as a design verdict.

## Output / boundaries

Write only `docs/handoffs/app-structure/review.md`. Do not edit any app/test/design/coordinator file or run runtime commands. Give concrete file/line and capture evidence, priority, impact and a minimal fix direction for findings; distinguish blockers from optional follow-ups and avoid speculative redesigns.

Use the five Impeccable finish sections—persistence, fidelity, ceiling, material_fixes, keep—with an explicit **ship / fix / recapture / rebuild** disposition. Include source/security/test-coverage findings in material_fixes. State exactly which images/source areas you inspected and any unverified limits; invalid captures require recapture rather than a design pass. Do not certify real-agent autonomy or unrelated screens. If the whole accepted scope has no blocking finding, say so at that scope; do not invent issues to fill a report.

After the report, tell Jonas the disposition and that the coordinator can consume the saved findings. Do not deploy or claim final Git integration occurred.
