# Worker A — navigation, Topics and discovery

## Status

Resumed on the approved shared branch `feature/app-structure` on November 12.
Coordinator launch status is READY. Existing A report and exported shell key type
are present; preserving these and the active B/C/D edits. **A implementation is
complete and ready for coordinator integration review.** Runtime acceptance is
not yet verified.
Runner is withheld; no servers, builds, typecheck, test suites, migrations,
installation or client generation will run in this session.

## Owned paths

- `src/components/app-shell.tsx`, `src/components/app-shell.css`
- `src/app/side-by-side.css` — navigation/layout/discovery only; theme rules frozen
- `src/app/globals.css` — necessary shared navigation/discovery rules only
- `src/app/discover/page.tsx`, `src/app/topics/**`, `src/components/topic-list.tsx`
- This progress file only within the handoff directory

## Planned / actual changes

Implemented:
- Shared role-aware shell: Home, gated Topics, Messages, People & agents; native
  More contains Public chat, human-only My agents, Agent rooms, Manage
  participation, My profile, Account settings, How it works. No duplicate menus.
- Topics uses its own active destination on directory/detail/discussion/create
  routes; directory is canonical, with canonical followed/pagination links.
- Legacy discovery Topics temporarily redirects, retaining scalar `followed=1`
  and a scalar CUID `after` via URLSearchParams; invalid/duplicate optional values
  are dropped. Topics-off legacy links browse profiles, without an invalid-view
  notice or unavailable redirect. Direct Topics query values reject malformed
  scalar/duplicate filters and preserve valid state through sign-in.
- People & agents retains Browse/Following and public-profile search/follows;
  accurate direct-chat/owner-read/invitation copy replaces old invitation-only
  language. Existing notice-to-tabs spacing stays untouched.
- Shared-space audience labels use Users rather than a lock; account/help/Home
  indicators reflect their scope. Conversation disclosure remains private.
- Four-column mobile primary nav adapts to three when Topics is disabled;
  long labels wrap. More and the desktop rail scroll when needed. Incoming theme
  pill and loading behavior are untouched.
- Topic/detail/new contextual links wrap and retain 44px link heights; discussion
  retains its existing live topic-name link and Topics is active in the shell.

Actual edited files: shell TSX/CSS, navigation-only side-by-side.css, discovery,
all five Topics pages, topics.css and topic-list. No globals.css edit needed.

## Published shell contract — available for B/C wiring

`AppShell` keeps its existing `account`, `active`, `title` and `children` props.
The exported `active` destination keys are:

`dashboard`, `topics`, `discover`, `inbox`, `public-room`, `profile`, `agents`,
`agent-setup`, `conversations`, `settings`, `guide`.

Routes: Home `/dashboard`; Topics `/topics`; People & agents `/discover`;
Messages `/inbox`; Public chat `/public-room`; My profile `/profile`;
human-only My agents `/agents`. Existing participation/room/settings/guide routes
remain. Source declaration is now available as exported `ShellDestination` in
`src/components/app-shell.tsx`; peers can use all keys now. Topics visibility
uses the existing server-side `topicsEnabled()` gate.

## Contracts needed / requests

No cross-file reassignment requested. B/C/D may record concrete shared navigation
or CSS requests in their own reports; A will read them at task boundaries.
Coordinator owns product/design records, theme-toggle implementation and runner.

D: shell primary nav is `aria-label="Workspace"`; More nav is
`aria-label="More destinations and account"`. Four enabled / three disabled links
are actual DOM items, with `data-destinations` selecting grid columns; More uses
native details/summary on desktop and mobile. Tests should expand More to reach
My agents, My profile, Public chat, Agent rooms and Manage participation. Legacy
redirect drops non-scalar/invalid optional filters, preserves CUID cursor + `1`.

Coordinator: the existing `src/components/discussion-panel.tsx` live topic-name
link is outside A ownership and preserved. Optional integration alignment: turn
that existing paragraph into a `topic-navigation` nav with Topics → live topic
name → Discussion; A has prepared wrapping/44px breadcrumb styles. No ownership
takeover or duplicated static topic metadata added. Context loader reports the
known stale design sidecar; no design documentation changes made by A.

## Checks / evidence

- Read-only `git status --short`: B/C/D and coordinator work is in progress at
  resumption. Preserved the existing A shell-type declaration and report.
- Read-only `git branch --show-current`: `feature/app-structure`.
- Read AGENTS.md, full approved plan, coordinator/peer reports, PRODUCT.md,
  DESIGN.md, Topics surface brief, Impeccable context/craft floor and installed
  Next.js redirect/page/searchParams/CSS guidance.
- `git diff --check --` limited to all eleven A-owned changed app files: passed.
- `prettier --check` limited to the same eleven files: passed. Initial formatting
  findings in four A files were fixed in one targeted formatting pass; no
  whole-checkout formatting.
- TypeScript `transpileModule` read/parse/transpile of eight A-owned TSX files,
  entirely in memory: zero syntax errors; no emitted/generated artifacts. This
  is a syntax check, not typecheck or runtime acceptance.
- Inspected navigation-only shared CSS diff: theme-toggle rules and the existing
  `.discovery-notice + .discovery-tabs { margin-top: 24px; }` are unchanged.
  No working diff in frozen theme-toggle/layout/loading paths. Root loading
  fallback remains absent. No domain/schema/dependency changes.
- Runtime checks, screenshots, keyboard/focus, both roles/themes at 320/360px,
  Topics-on/off, full typecheck/build/suites/restarts remain UNRUN; D needs the
  coordinator's explicit runner grant. No server/DB/process mutations performed.

## Blockers / failed-fix counter

No implementation blockers. No repeated failed fixes (0).

## Next action

Coordinator can review/integrate A now. D should cover role-aware navigation,
enabled/off Topics, temporary legacy redirect with scalar followed/cursor state,
every nested Topics active state, 320/360px wrapping, More keyboard operation and
preserved theme pill/spacing/loading baseline in the scheduled runner.
