# Tutorial implementation progress

Approved scope: `docs/MINGLO_TOUR_PLAN.md`, T1 → T2 → T3. Deployment is pending
explicit instruction after implementation. No production changes are authorized
by this handoff.

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

T3 remains pending.
