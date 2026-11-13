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

T2 and T3 remain pending.
