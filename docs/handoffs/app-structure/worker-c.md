# Worker C — Home, Messages and copy

Status: **C implementation complete; ready for coordinator integration review and D's scheduled runner.** Confirmed launch READY and branch `feature/app-structure`. Runner remains NOT GRANTED. No workers spawned, branches switched, Git mutations, commits, pushes or deployment. No server/build/test/typecheck/DB/generation command run.

## Ownership and actual changed files

Created this report before application edits. All production changes are within C ownership:

- `src/app/dashboard/page.tsx` — actionable room invitations, incoming personal requests, other personal returns and followed unread discussions before owner contributions/setup; read-only agent returns stay classified. Zero-agent humans with personal activity see it before connection guidance. Generic attention previews exclude direct requests/messages so they cannot remix personal and observed activity. Sparse activity offers People & agents/Public chat and gated Topics. Home remains read-only.
- `src/app/dashboard/home.css` — new local Home spacing, wrapping and 44px contextual link targets; no shared CSS edits.
- `src/components/home-return-links.tsx` — consumes D's separate incoming/personal/observing groups, preserves source links, labels incoming vs outgoing requests and read-only observation. Discussions keep their separate bounded group.
- `src/components/owner-progress.tsx` — `/agents` management link even for a single agent; selected-agent participation anchor; current public-directory label. Existing contribution/read/participation services unchanged.
- `src/app/inbox/page.tsx` — strict scalar closed query shape, zero-based bounded pages, exact D helper wiring, generic not-found on invalid/revoked filters even on Updates, selected-agent context/Clear filter, filter-preserving tabs/archive/shared pager. Incoming personal request count plus the full viewer-owned room-invitation count; observed pending count separately labeled Read only. Full invitation count avoids treating a 50-row preview as the total. Updates explicitly stays account-scoped.
- `src/app/inbox/messages.css` — local filter/group/count/pager layout, wrapping and touch targets.
- `src/components/direct-chat-groups.tsx` — new local Messages presentation. Personal vs read-only groups use D's participant classification, incoming/outgoing/observed pending labels, declined/cancelled history and existing muted/unread states. One shared pager remains in the page; empty groups say **on this page**, never imply independent pagination. Original outer Direct chats / Direct chat requests region names retained.
- `src/app/messages/[id]/page.tsx` — presentation/copy only: participant vs Read only subtitle and Manage participation label. Send, consent, decisions, reports, archive and explicit read controls unchanged.
- `src/app/guide/page.tsx` — explains Topics (gated), Public chat, direct chats and agent rooms; distinguishes profile/topic/discussion follows and separate owner/agent reading positions. Explains self profile vs My agents and the three distinct participation facts.
- `src/app/public-room/page.tsx` — copy/contextual navigation only; signed-in audience, Person attribution, current names and direct-vs-agent-room explanation. No permissions/service changes.

No edits to shared shell/global CSS, services, tests, actions, validation, protected theme/layout/loading baseline or coordinator-owned documentation.

## Contracts consumed and decisions acknowledged

Read A's shell contract and D's published helper contract before dependent edits. Final signatures/types are present in source and match C consumption:

```ts
listDirectChats(accountId, view, page, archived, agentId?)
// DirectChatList: items, page, hasNext, selectedAgent,
// counts: { incoming, observedRequests }
// DirectChatItem: isParticipant/access, pending-only requestDirection,
// Prisma DirectRequestStatus including CANCELLED
getDirectReturns(accountId)
// { incoming, personal, observing }, independently selected/bounded by D
```

- InvalidDirectAgentFilterError becomes generic `notFound()`, with no broader fallback. Empty/non-owned/disconnected/agent-account filters flow into the authorized helper; array/duplicate/unknown queries fail before list rendering.
- Actual participant status controls grouping even when the other participant is the viewer's connected agent.
- B/D zero-based query contract accepted: `view=chats|requests|updates`, `archived=1`, `page=0..200`, Agent row ID `agent`. Page resets when changing view/archive/filter; agent persists on all list navigation. Canonical first-page URLs omit page; explicit page 0 remains accepted. No Next page link beyond page 200.
- Coordinator progress check 2 accepted account-scoped Updates. C validates selected-agent ownership through D on that view, discloses beside its context that Updates belongs to the signed-in account, and retains the filter on navigation. No new filtered-attention helper is needed.
- No read-position/preference/subscription writes added. D retains all preview reader locks/rechecks and archive predicates. No direct IDs pass through legacy message hydration.

## Requests / dependencies

- **Coordinator:** C is complete and needs integrated semantic/runtime/rendered review when A/B/D are ready. No reassignment or shared CSS change requested. Please update product/design/surface records using integrated rendered evidence; these remain coordinator-owned.
- **D:** existing regression requests remain: incoming decisions vs outgoing sent items, observed counts/labels, participant precedence, >30 observed chats not crowding out an older personal request, zero-agent human priority, invalid/duplicate/revoked filters including Updates, archive/shared paging context and no implicit read acknowledgments. New local component headings are Your chats / Your agents’ chats; Requests you can decide / Your agents’ requests. Home incoming region is Chat requests for you; existing Your direct chats and Your agents’ direct chats region names remain for the other groups.
- D's corrected CANCELLED status contract and coordinator ownership/Updates/query decisions were reread at the final boundary. No further read contract is outstanding.

## Checks and results

Read AGENTS.md, approved implementation plan, coordinator and peer records, incumbent C sources/read helpers, PRODUCT.md/DESIGN.md and Home surface brief, applicable Impeccable craft guidance and installed Next.js page/searchParams/notFound/client guidance. Existing baseline design/preview evidence is not claimed as implementation verification.

Formatting writes were limited to the exact ten C production files above. Final commands:

```sh
node_modules/.bin/prettier --check src/app/dashboard/page.tsx src/app/dashboard/home.css src/components/home-return-links.tsx src/components/owner-progress.tsx src/app/inbox/page.tsx src/app/inbox/messages.css src/components/direct-chat-groups.tsx src/app/messages/'[id]'/page.tsx src/app/guide/page.tsx src/app/public-room/page.tsx

git diff --check -- src/app/dashboard/page.tsx src/app/dashboard/home.css src/components/home-return-links.tsx src/components/owner-progress.tsx src/app/inbox/page.tsx src/app/inbox/messages.css src/components/direct-chat-groups.tsx src/app/messages/'[id]'/page.tsx src/app/guide/page.tsx src/app/public-room/page.tsx
```

Both passed. A memory-only Node stdin script parsed the eight listed TSX files using installed TypeScript `createSourceFile(..., ScriptTarget.Latest, true, ScriptKind.TSX)` and inspected `parseDiagnostics`: **8 parsed, 0 syntax errors**. No app modules executed or generated artifacts written. This is **not** semantic typechecking or runtime verification.

Impeccable's edit hook reported no deterministic design issue on scanned files. This is not a rendered review. Semantic typecheck, build, browser tests, security/unread regressions, enabled/off gates and both-theme 320/360px/desktop rendered evidence are **NOT RUN** because the shared runner is withheld. D must perform scheduled acceptance checks; C remains available for concrete owned-file failures.

## Blockers and failed-fix counters

No implementation blocker. No failing verification/fix loops; counters **0**. Runner withholding is the outstanding integration constraint, not permission to run checks in another terminal.

## Next action

Coordinator reviews/integrates C with A/B/D and grants D the runner only under the saved protocol. Resume this existing C terminal for any assigned C-file defect; do not spawn a replacement, transfer file ownership implicitly or treat source readiness as full-task acceptance.
