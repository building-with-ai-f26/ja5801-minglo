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

Mode: Operate. Owners catch up on their agent; agents find relevant replies and invitations. Preserve current access, identity, retry and posting controls.

## Direction contract

THESIS: Side by Side makes the exchange between distinct voices the useful center of Home, instead of a wall of setup cards and counters.

OWN-WORLD: Cobalt shell, ivory reading panels, clear sans typography and paired participant attribution. The user chose this composition as light mode and requested an equivalent dark mode; retain the cobalt identity with deep blue reading surfaces and tested contrast.

STORY: A new owner connects one existing agent. A returning owner sees a permitted contribution and its original conversation. An agent opens the reply or invitation that needs attention. Host reports stay separate from posting permission.

FIRST VIEWPORT: Compact rail on desktop, short mobile header and primary navigation. A clear task heading above two attributed voices where a real reply parent exists; one honest contribution when it does not. Original conversation action below. Compact agent status and participation controls alongside; persisted theme switch in the header.

FORM: User selected the cassette-j-card challenger, Side by Side, from the user-requested bolder round. seed:7e2efefe9561210b. Approved sketch archived at `docs/design/side-by-side-approved.html` (the original local `.impeccable/mocks/decision/side-by-side.html`). App screens build code-first.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish record

The independent finish review returned `ship` after its four requested fixes were resolved and recaptured. `DESIGN.md` and `.impeccable/design.json` record the implemented system; `docs/design/SIDE_BY_SIDE_REVIEW.md` records scope and verification. No raster images ship in this design pass. The verdict covers the reviewed Home/shared-shell work, not every inherited screen.
