# Worker B — own profile, agents and participation

Status: **B IMPLEMENTATION COMPLETE — ready for coordinator integration and D verification.** Confirmed coordinator launch READY and branch `feature/app-structure`. Runner NOT GRANTED; no servers, builds, suites, generation, migrations or Git mutations run.

## Owned paths

`src/app/profile/**`, new `src/app/agents/**`, `src/app/agent-setup/page.tsx`, `src/app/conversations/page.tsx`, profile/participation/routine components, narrowly extracted disconnect component, `src/app/actions/account.ts`, `src/app/actions/agent-routine.ts`, `src/app/actions/participation.ts`, `src/lib/validation.ts`, local profile/agents styles, this report.

## Planned / actual files

Implemented: separate self profile/human agent management; shared unchanged disconnect disclosure/confirmation; four exact agent links; stable authorized-list participation anchors; current-owner Agent-ID room filters by intersection; moved-destination action refreshes; narrow sign-in returns.

Actual app files: `src/app/profile/page.tsx`, new `src/app/profile/profile.css`, new `src/app/agents/page.tsx`, `src/app/agent-setup/page.tsx`, `src/app/conversations/page.tsx`, `src/components/profile-editor.tsx`, `src/components/agent-routine.tsx`, new `src/components/disconnect-control.tsx`, `src/app/actions/account.ts`, `src/app/actions/agent-routine.ts`, `src/app/actions/participation.ts`, `src/lib/validation.ts`.

- Human self profile shows the person's name, handle, bio/interests and public-profile link, with editing expanded by `edit=1`; agent self profile retains claim creation and disconnection. Human management is exclusively `/agents`; an agent visiting it redirects to `/profile`.
- Each connected-agent card shows posting permission separately from the self-reported host return status and recorded check-in, four agreed navigation links, and unchanged disconnect disclosure/confirmation. Participation anchors exist only on the current owner's loaded list.
- Profile saves, claims/disconnection, routine saves/check-ins and participation changes invalidate `/agents` alongside existing destinations. Disconnection also refreshes Messages and its actual `/messages/[id]` page pattern. Claim still redirects to `/dashboard?claimed=1`.

## Contracts / requests

- Consume A's `profile`, `agents`, `agent-setup`, `conversations` shell keys.
- C/D: Messages allowlist will support scalar `view=chats|requests|updates`, `archived=1`, bounded integer `page=0..200` (existing zero-based convention), and validated Agent row `agent`; duplicates/unknown params rejected. Rooms accept only one valid `agent`. Profile accepts only `edit=1`; `/agents` has no query.
- D: please cover self-profile/agent redirect, four card links, current-owner room filtering incl creator/member intersection, malformed/duplicate/revoked filters, safeNext continuations, moved-route refreshes and participation anchors. B does not own tests.
- No shared CSS changes requested; local styles only.
- Exact additional returns: `/topics?followed=1&after=<cuid>` and scalar subsets, legacy `/discover?view=topics&followed=1&after=<cuid>` and scalar subsets retaining `view=topics`. Topics/discussion/message/profile/claim existing destinations remain. Query order is unrestricted; unknown/duplicate keys, invalid values, external paths and fragments fall back to `/dashboard`.
- D: room filtering locks the selected Agent row with the claim/disconnect lock before fresh owner validation and a room query with `AND: [readableRooms(viewer), selected creator-or-accepted-member]`. No filter broad fallback; unrelated/disconnected/agent-account/array/empty/malformed filters call generic `notFound()`. The unfiltered route keeps independent access and public-chat context.
- Coordinator: Impeccable reports the already-known stale design sidecar; B leaves coordinator-owned design records untouched. User's no-spawn and runner limits take precedence over skill review tooling. Final rendered review belongs to scheduled integration verification.
- A: `safeNext` now supports the Topics directory and legacy-discovery query shapes above if your owned route needs to retain them through sign-in. No shared CSS or source assignment needed from B.
- D: legacy `owner-controls.spec.ts` previously disconnects from human `/profile`; move that management journey to `/agents` while retaining its security assertions. B deliberately did not edit tests. New UI uses heading `My profile` for both roles and `Agent rooms` for `/conversations`.

## Checks / blockers / failed fixes

Read AGENTS.md, full approved plan, coordinator and peer reports, PRODUCT.md, DESIGN.md, Impeccable context/new-work/craft-floor, relevant Next.js page/redirect/revalidatePath guides and incumbent sources/styles. Read-only branch/status confirmed expected shared branch; only peer handoffs were untracked on entry.

- `git diff --check -- src/app/profile src/app/agents src/app/agent-setup/page.tsx src/app/conversations/page.tsx src/components/profile-editor.tsx src/components/agent-routine.tsx src/components/disconnect-control.tsx src/app/actions/account.ts src/app/actions/agent-routine.ts src/app/actions/participation.ts src/lib/validation.ts docs/handoffs/app-structure/worker-b.md` — passed.
- `node_modules/.bin/prettier --check` on the 12 app files enumerated above — passed. Formatting writes were limited to those exact B files; no whole-tree formatting.
- Memory-only Node/TypeScript `transpileModule` check on all 11 final B TS/TSX files — passed; syntax/transpilation only, **not** a semantic typecheck. No generated artifacts.
- Memory-only Node evaluation of the owned `safeNext` module with strict assertions: **23 accepted and 33 rejected inputs passed**. Included page 0/200 and all Messages parameters together; rejected page 201/negative/decimal/leading-zero, duplicate/encoded-duplicate/array/unknown parameters, external/protocol-relative paths, fragments, invalid Agent IDs and malformed query separators. Preserved existing topic/discussion/message/profile/claim routes. No app server/database/persistent test file.
- Hook found no deterministic design issue on scanned files. Runtime, rendered, semantic typecheck/build and browser/suite verification **NOT RUN** (runner withheld). Failed fixes: **0**; no issue has failed verification twice. No implementation blocker.
- Reread coordinator progress check 2 and relevant A/C/D contracts at final boundary. Zero-based Messages pagination and current-ownership checks remain aligned; no cross-file takeover.

## Next action

Coordinator can integrate B. D must run scheduled semantic typecheck, browser/security/refresh tests and both-theme narrow-screen rendered review after the explicit runner grant. B is ready to address concrete owned-file failures; full-task acceptance remains unverified until that run. No user approval or cross-file reassignment is needed to integrate B's implementation.
