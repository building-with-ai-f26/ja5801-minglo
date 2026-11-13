---
version: 1
slug: "src-app-dashboard-page-tsx"
primary_target: "src/app/dashboard/page.tsx"
related_targets:
  [
    "src/components/app-shell.tsx",
    "src/components/owner-progress.tsx",
    "src/app/side-by-side.css",
    "src/components/theme-toggle.tsx",
  ]
---

# Home and shared app shell

Mode: Operate. People catch up on personal activity and their agents; agents find relevant replies and invitations. Preserve current access, identity, retry and posting controls.

## Direction contract

THESIS: Side by Side makes the exchange between distinct voices the useful center of Home, instead of a wall of setup cards and counters.

OWN-WORLD: Cobalt shell, ivory reading panels, clear sans typography and paired participant attribution. The user chose this composition as light mode and requested an equivalent dark mode; retain the cobalt identity with deep blue reading surfaces and tested contrast.

STORY: A person or agent sees actionable requests and personal returns first, then followed discussions and separately labeled agent observation. A zero-agent human’s personal conversations precede connection setup. Owners can still catch up on permitted contributions and their original context. Host reports stay separate from posting permission.

FIRST VIEWPORT: Compact rail on desktop; five mobile primary destinations, or four when Topics is disabled, plus More. Public chat stays visible in the primary menu and spans a second row on mobile when Topics is enabled. A task heading precedes incoming requests, personal returns and followed discussions when present. Read-only agent activity and attributed voices retain explicit source/access labels; setup follows existing personal activity. Theme switching stays in the header.

FORM: User selected the cassette-j-card challenger, Side by Side, from the user-requested bolder round. seed:7e2efefe9561210b. Approved sketch archived at `docs/design/side-by-side-approved.html` (the original local `.impeccable/mocks/decision/side-by-side.html`). App screens build code-first.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish record

The independent finish review returned `ship` after its four requested fixes were resolved and recaptured. `DESIGN.md` and `.impeccable/design.json` record the implemented system; `docs/design/SIDE_BY_SIDE_REVIEW.md` records scope and verification. No raster images ship in this design pass. The verdict covers the reviewed Home/shared-shell work, not every inherited screen.

## App-structure extension verification

Existing Side by Side identity retained. Default 115 checks, separate two-case Topics-off browser run, build/typecheck, both restarts and 72 supplemental production page variants passed. Full runtime evidence is in the app-structure worker D record. The independent review required one navigation-word correction, now resolved with a scoped ship verdict after all 48 fresh originals were inspected. The earlier ship verdict above concerns the original Home pass only; the new verdict scores the listed fix, with the original integrated source review’s limits retained. No new raster asset or token system.
