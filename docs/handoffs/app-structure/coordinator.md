# App structure coordinator

Date: November 12, 2026 (America/New_York).
Mode: **four independent worker terminals A–D sharing one checkout**. No spawned or duplicate workers.
Scope: the owner approved `docs/APP_STRUCTURE_PLAN.md` and its multi-file implementation. The initial implementation/review phase prohibited deployment. **Current authorization: Jonas has now explicitly requested the coordinator finish pending commits, merges and deployment; the coordinator may deploy after the reviewed Git integration.** Historical worker/reviewer no-deploy instructions still describe their narrower role.

## Launch status

**COMPLETE — A–D and independent review are finished; the integrated application is deployed as Heroku v28. Do not relaunch these workers.** All use `/Users/jonasal-taher/code/Jonas-09/ja5801-minglo` on the same **`feature/app-structure`** branch. No worker has been spawned by this coordinator. Jonas launches the independent terminals using the prompts below; each worker records its actual start in its own report.

## Checkout and preserved baseline

- Implementation base: **`d5783d6a9ff921deb78a3bd9b60b071e7c4b585f`**, `Polish theme toggle and smooth page navigation`. `main` and GitHub `origin/main` matched this commit at readiness. All application changes present before the app-structure task are committed and pushed.
- This supersedes the plan’s historical `e87b5fe` snapshot and this coordinator’s initial inspection at `88ec702`. Preserve the already-shipped account-created Topic domain, schema/migrations, UI and tests.
- The incoming 64px Sun/Moon pill, its 44px tap height and updated `DESIGN.md` are preserved by `d5783d6`. The old global `src/app/loading.tsx` fallback was deliberately removed by that same completed loading-transition task; do not reintroduce the white “Finding your corner” interstitial.
- Discovery spacing is committed as `20dc6a8`, merged by `496dd45`. It adds `.discovery-notice + .discovery-tabs { margin-top: 24px; }` in `side-by-side.css`. Preserve the gap while changing discovery navigation. The spacing author’s commit records its own checks; that history is not a new coordinator acceptance run.
- Jonas confirmed the prior spacing and loading sessions are finished. The previously observed deletion was their completed loading task, not a worker change to undo. **Active source-editing overlap is resolved.** A now receives the shared navigation/global CSS lease below; theme component and design-document ownership remain reserved to the coordinator.
- Exact original incoming copies/patch and SHA-256 manifest are private under ignored `.local/app-structure/baseline/`. A final committed baseline manifest is also saved there. These are evidence, not permission to restore old snapshots over later edits. No stashing, reset or lost work was used.
- One existing dev preview remains: port **3001**, PID **41672**, this checkout. It is reserved for coordinator-scheduled use, not a worker-owned server. The old port-3000 production preview was stale and is stopped. A competing dev start was refused by the existing `.next` lock; no further server was started. Before D’s build/test lease, coordinator must stop/clear the 3001 preview and confirm `.next` ownership. Do not kill arbitrary processes or start a second server.
- This coordinator has made **no deployment, Heroku configuration change, production data change, dependency install or migration**. Do not assume another session’s completion proves a current hosted version; production rollout is outside this task.

## Execution sequence

1. **Complete:** verified the other sessions committed and pushed the finished incoming changes; established `feature/app-structure` from `d5783d6`. Only coordinator handoff documentation is added before worker launch; no duplicate theme/spacing patch is created.
2. Jonas starts exactly one independent terminal for each of A, B, C and D using the prompts below. Every worker creates and exclusively updates its own progress record before app edits.
3. A publishes shell keys early; D publishes exact read-helper signatures/types early. B and C proceed with independent work while dependencies are being agreed. Source files existing is not completion evidence.
4. Coordinator reads all reports, resolves cross-file requests, reviews integrated links/permissions and updates its own product/design documentation. No reassignment is implicit.
5. Once A–C and D's service changes are explicitly complete and integration is reviewed, coordinator grants D the shared runner in writing here. D runs the required verification serially and routes failures to the file owner.
6. After checks, schedule the later independent review. Coordinator makes focused commits with explicit path staging, checks the combined diff and pushes according to the existing Git workflow. No rollout is authorized.

## Exclusive file ownership

The table assigns whole files unless a narrower scope is stated. Workers may read any project file. Request an assignment here before creating/editing a file outside your list; silence is not approval. Existing protected theme rules below take precedence over A's CSS assignment.

| Owner | Exclusive production files / scope |
| --- | --- |
| A — navigation, Topics, discovery | `src/components/app-shell.tsx`, `src/components/app-shell.css`, `src/app/side-by-side.css` (navigation/layout/discovery changes only), `src/app/globals.css` (only necessary shared navigation/discovery rules), `src/app/discover/page.tsx`, `src/app/topics/**`, `src/components/topic-list.tsx`. Preserve topic creation and the launch gate. |
| B — profiles, agents, participation | `src/app/profile/**`, new `src/app/agents/**`, `src/app/agent-setup/page.tsx`, `src/app/conversations/page.tsx`, `src/components/profile-editor.tsx`, `src/components/participation-control.tsx`, `src/components/agent-routine.tsx`, `src/components/routine-report-form.tsx`, a narrowly extracted disconnect component if needed, `src/app/actions/account.ts`, `src/app/actions/agent-routine.ts`, `src/app/actions/participation.ts`, `src/lib/validation.ts`. New local profile/agents styles stay with B. |
| C — Home, Messages, copy | `src/app/dashboard/page.tsx`, `src/components/home-return-links.tsx`, `src/components/owner-progress.tsx`, `src/app/inbox/page.tsx`, `src/app/inbox/messages.css`, `src/components/inbox-list.tsx`, `src/components/attention-list.tsx`, `src/app/messages/**` (only needed presentation/copy), `src/app/guide/page.tsx`, `src/app/public-room/page.tsx` (copy/contextual navigation only). New local Home/Messages components/styles stay with C; no shared global CSS edits. |
| D — authorized reads and verification | `src/lib/direct-views.ts`, `src/lib/return-activity.ts`, new narrowly necessary read-layer helper/type files after publishing their paths/signatures, `tests/**`, `playwright*.config.ts`. Explicit additional assignment: `scripts/check-restart.mjs` and `scripts/check-topic-restart.mjs`, limited to legitimate new route/label/continuity assertions; preserve existing security and persistence checks. |
| Coordinator | This record, `docs/APP_STRUCTURE_PLAN.md`, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/**`, other project documentation and final integration; the completed narrow breadcrumb edit in `src/components/discussion-panel.tsx`. `src/components/theme-toggle.tsx`, `src/app/layout.tsx` and the intentional absence of root `src/app/loading.tsx` remain frozen as incoming baseline; changes require explicit reassignment. `package.json`, lockfile, shared components not listed above, and core write/claim/pause/moderation services remain unassigned/frozen unless a specific need is reviewed. |

Each worker also exclusively owns `docs/handoffs/app-structure/worker-a.md`, `worker-b.md`, `worker-c.md` or `worker-d.md` for its letter. Do not create or edit another worker's report. Only the coordinator edits this record or the plan.

### Protected theme baseline / overlap resolution

- Prior editors have finished per Jonas, and their work is committed/pushed. A alone now receives the shared CSS editing lease for this implementation; B/C/D send CSS requests to A.
- A preserves all incoming `.theme-toggle*` rules, dark-theme icon/indicator behavior and the removal of the old mobile-only 44px width override. Do not replace this file from an old branch or whole-format it to apply navigation changes.
- `src/components/theme-toggle.tsx` is not A's file. `DESIGN.md` belongs only to the coordinator. A must not reinstate the old 128px label switch or remove the new pill through a broad media-query rewrite.
- Changing shell layout may legitimately affect the theme control's surroundings. If the control itself needs a change, record the concrete reason and request coordinator assignment before touching its code/rules.

## Settled route / UI contracts

- Home `/dashboard`; Topics `/topics`; People & agents `/discover`; Messages `/inbox`; Public chat `/public-room`; human-only My agents `/agents`.
- `/profile` and `/profile?edit=1` represent the signed-in account. Authenticated agents visiting `/agents` redirect to `/profile`; never render the owner's management data.
- Mobile primary destinations: Home, Topics, Messages, People & agents, plus accessible More for Public chat, human My agents, Agent rooms, participation and account/help actions as appropriate. When Topics is disabled, remove its slot and adapt the grid. Preserve keyboard operation, wrapping long labels and touch targets in both themes.
- A supplies destination keys `topics`, `discover`, `profile`, `agents`, retaining `agent-setup`, `inbox`, `conversations`, `public-room`, `dashboard`, `settings`, `guide`. A records availability early so B/C can wire active keys without inventing alternatives.
- Account menu includes My profile, Account settings, How it works. No My agents entry for agents. Agent rooms remain reachable for both roles. Agent accounts have a discoverable Manage participation link. Keep theme/sign-out accessible without duplicate mobile entries.
- `/discover?view=topics` temporarily redirects to `/topics` only while enabled; scalar validated `followed` and `after` state survives through `URLSearchParams`. Disabled legacy links fall back to ordinary profile discovery. Direct gated topic routes stay unavailable. Do not substitute a permanent cached redirect.
- Each owner agent card uses exactly: View profile → `/profiles/[handle]`; Manage participation → `/agent-setup#agent-[agentId]`; View agent rooms → `/conversations?agent=[agentId]`; View direct chats → `/inbox?agent=[agentId]`.
- The `agent` filter uses an **Agent row ID**, not an Account ID. Validate current ownership server-side; malformed, unrelated, disconnected or agent-account filters return generic not-found, never a broad fallback. Intersect the filter with current room/direct read access. A human's actual participant rights take precedence over derived owner observation, including when chatting with their own agent.
- Preserve the selected agent across Messages tabs, archive controls and pagination; reset page on changing view/filter. Show selected-agent context and Clear filter. Use one shared pager when data still shares one page.
- B owns `safeNext` additions for own profile, `/agents`, filtered rooms and supported Messages query combinations. Retain existing allowlisted destinations, reject unknown/duplicate/non-scalar/unexpected parameters and external/protocol-relative URLs. B and D agree exact accepted query sets in their records.

### Messages query / pagination decision — progress check 1

- Preserve existing **zero-based** service and URL pagination: omitted `page` means first page (0); `page=0` remains accepted for compatibility, and 1 is the second page. Known scalar page values are bounded integers 0–200. Canonical first-page links omit `page`. Do not reinterpret existing page links as one-based.
- This clarifies C’s initial “positive integer” wording; C/B/D must use the same convention. Keep `agent` when changing tabs/archive/page; changing view/filter resets `page`. Tab switches drop the Chats-only archive context; archive links keep the selected agent and reset pagination.
- Supported `view` values are `chats`, `requests`, `updates` (omitted means chats); `archived=1` applies to Chats only. Scalar `agent` is an Agent row ID authorized on each request, not an Account ID. Unknown, duplicate or non-scalar parameters are not valid sign-in return destinations. Preserve other existing allowlisted routes.
- A’s published destination contract matches the settled coordinator list and is accepted for B/C wiring. Its source declaration was still pending at this check; do not run shared verification on partial integration.
- No helper signature is imposed on D here. D publishes exact exports/types and B/C consume or request a change through their records. No ownership transfers or runner grant result from this check.

## D → C read contract and selection requirements

D publishes exact exported signatures/types in `worker-d.md` **before** C wires the read results. The coordinator is not inventing a competing helper interface. Preserve current caller compatibility where practical. C reads the published contract at each dependency boundary and records agreement/questions in `worker-c.md`.

Required semantics:

- Optional selected-agent filtering is authorized inside the read path, including current-owner validation and private-preview rechecks under existing reader locks.
- Each row provides personal participant versus current-owner read-only classification; pending personal requests distinguish incoming from outgoing.
- Requests tab's decision count includes actionable incoming personal requests and the viewer's own agent-room invitations; owner-observed requests have a separate read-only count. Outgoing personal requests remain in Chats. Counts and lists share access/filter predicates.
- Home selects **before list limits**: at most three actionable incoming personal requests, three other personal returns (unread/unmuted active or outgoing pending), and three owner-readable agent returns/requests. More than 30 recent observed chats must not crowd out an older personal request. Stable recency/ID ties, no repeated conversation IDs across groups, participant status first. Discussion returns stay separately bounded.
- None of these queries acknowledges read positions, subscribes a viewer, changes archives or expands read/post/decision permissions. No schema migration or dependency is expected.

## Shared resource / runner lease

**CURRENT RUNNER: RELEASED. Local verification, independent review, Git integration and the authorized deployment are COMPLETE.** The completed lease below is historical and must not be used to start another test run. App/test source stays frozen for independent review. Coordinator documentation updates are permitted; no competing server, new dependency, schema change or deployment is authorized. Do not run whole-tree formatting, stage/commit/pull/reset/stash/switch branches, or push/deploy. Coordinator owns Git mutations. Read-only source inspection and checks limited to owned files that do not mutate shared generated artifacts are permitted; record their scope.

D prepares test cases/configuration now, including a dedicated real Topics-off app environment and exclusion of its off-only tests from the enabled run. Service-only environment toggles do not prove served pages use the disabled flag. All reset targets must end in `_test`; no production or existing development DB reset.

The active lease records A–D completion, current HEAD/working diff, named databases, ports, `.next` owner, preview clearance and ordered commands. D must read that lease and update its own report on resumption; other terminals appearing idle is not an additional grant. No concurrent servers/builds sharing `.next`; isolate database, ports **and** build directory deliberately or serialize them.

Required final evidence, serially scheduled:

1. Typecheck and meaningful focused tests covering all changed journeys.
2. Full default `npm test`, with exact failures/retries/limitations and no weakened assertions or skipped required checks.
3. Dedicated Topics-off browser suite with both runner and server gate false; both roles, all entry points, legacy discovery fallback and no blank mobile slot.
4. Production build, `npm run test:restart`, `npm run test:topics:restart` following current scripts/test prerequisites.
5. Rendered desktop and 320/360px coverage in both themes and roles, More open/closed, long names/labels, enabled/off navigation, manual keyboard/focus and touch-target evidence.

Baseline checks are only baseline checks, not proof of this implementation or a real Muse return. No rollout or host task is authorized.

## Baseline preflight evidence

- `npm run typecheck`: passed against the completed incoming baseline. `git diff --check`: passed.
- Read-only current-preview check on port 3001: passed at 1440, 390 and 320px. Theme switch stayed 64px wide in both modes, with a 44px-or-larger tap height; a new dark-device context defaulted to light, explicit dark preference survived reload, and no page errors or horizontal overflow were observed. Six local captures and JSON evidence are ignored under `.local/app-structure/baseline/`.
- This check neither created accounts nor reset a database and verifies only the incoming theme baseline. App-structure implementation, enabled/off navigation and the required new regression runs are **not yet performed**.
- The initial port-3000 check used a stale artifact. A restart was refused because the existing dev instance was already on 3001. Source stayed unchanged; subsequent verification used that actual instance after the prior session finished. No repeated app-fix loop or weakened assertion was used.

## Worker progress protocol

Each worker creates its own file first, with: status; owned paths; planned/actual changed files; contracts supplied/needed; requests to named owners; checks and exact commands/results; blockers; failed-fix counter; next action. Keep it current at task boundaries and end with a concrete completion report. Do not claim a check passed without running it.

Read this coordinator record and relevant peer records at task boundaries and before dependent edits. Do not poll repeatedly or wait forever: complete independent work, write the precise dependency and tell Jonas which terminal needs a short resume prompt. Independent terminal sessions cannot assume this chat's collaboration tools can message/control them. I will not spawn replacements for existing terminals.

Two-failed-fixes rule: for the same defect, record attempt 1 and attempt 2, symptoms, actual change and verification result. If both fail, stop work on that defect, preserve evidence and ask Jonas before attempt 3. Do not reset the counter by renaming the issue, changing agent or weakening a test. Continue unaffected work where possible.

## Integration ledger

| Work | State | Dependency / next action |
| --- | --- | --- |
| Incoming editing overlap | Resolved | Completed loading/theme task is `d5783d6`; spacing is `20dc6a8`/`496dd45`; all are pushed. Preserve their behavior. |
| Shared branch and launch | COMPLETE / MERGED | Focused commits on `feature/app-structure` pushed and merged into main as `4b8250a`; no duplicate worker was spawned. |
| A | IMPLEMENTATION COMPLETE | Final source checks reported. Full shell/Topics/discovery integration available; runtime/render verification delegated to D. |
| B | IMPLEMENTATION COMPLETE; ready for integration | B’s final report enumerates 12 app files and source-only checks. Coordinator inspected routes/cards/anchors/disconnect extraction and refresh paths. Runtime/semantic/render verification still pending D. B retains ownership for any findings. |
| C | IMPLEMENTATION COMPLETE | Final Home/Messages wiring and source checks reported; runtime/render verification delegated to D. Coordinator’s small archive-tab integration patch is complete. |
| D | VERIFICATION COMPLETE; RUNNER RELEASED | 115 default + 2 Topics-off cases passed; focused 15, typecheck, build and both restarts passed. 72 production page variants plus keyboard/touch evidence. |
| Independent review | COMPLETE; required F1 RESOLVED / SHIP | Original source/visual review plus scoped verdict in `review-f1.md`; all 48 fresh originals inspected. F2/F3 are inherited nonblocking follow-ups. |
| Deployment | COMPLETE — Heroku v28 | Reviewed merge `4b8250a`, backup b009, 20 migrations with none pending, live health/access/theme checks passed. |

## Launch prompts — use only after status is READY

Run all terminals in the exact shared directory above, on the published implementation branch. No separate pulls or checkouts. These prompts approve only the saved implementation scope.

### Terminal 1 — A

```text
Work in /Users/jonasal-taher/code/Jonas-09/ja5801-minglo. Read AGENTS.md, docs/APP_STRUCTURE_PLAN.md and docs/handoffs/app-structure/coordinator.md. The user approves this plan. Confirm coordinator status READY and branch feature/app-structure, then implement A only: navigation/shell, Topics, People & agents discovery. Create and update docs/handoffs/app-structure/worker-a.md first. Publish shell destination keys early. Preserve the committed pill theme switch, removed root loading interstitial and 24px gap between the Public chat notice and discovery tabs. Respect exclusive ownership and send cross-file requests through the records. Read peer reports at task boundaries. Do not spawn workers, switch/pull/reset/stash branches, stage/commit/push, deploy, whole-format the checkout, or start builds/test/dev servers without a coordinator runner grant. Stop after two failed fixes to the same defect and report evidence before a third. Complete your owned work and record exact remaining dependencies/checks.
```

### Terminal 2 — B

```text
Work in /Users/jonasal-taher/code/Jonas-09/ja5801-minglo. Read AGENTS.md, docs/APP_STRUCTURE_PLAN.md and docs/handoffs/app-structure/coordinator.md. The user approves this plan. Confirm coordinator status READY and branch feature/app-structure, then implement B only: own profile, human My agents, participation anchors, agent-room filter, affected action refreshes and safeNext return paths. Create and update docs/handoffs/app-structure/worker-b.md first. Preserve current-owner history/access, disconnection and pause guarantees; agent filters are Agent IDs and cannot widen access. Send shared CSS/navigation requests to A and direct-chat/read requests to C/D through the records. Do not spawn workers, switch/pull/reset/stash branches, stage/commit/push, deploy, whole-format the checkout, or start builds/test/dev servers without a coordinator runner grant. Stop after two failed fixes to the same defect and report evidence before a third. Complete your owned work and record remaining dependencies/checks.
```

### Terminal 3 — C

```text
Work in /Users/jonasal-taher/code/Jonas-09/ja5801-minglo. Read AGENTS.md, docs/APP_STRUCTURE_PLAN.md and docs/handoffs/app-structure/coordinator.md. The user approves this plan. Confirm coordinator status READY and branch feature/app-structure, then implement C only: Home, Messages, selected-agent direct-chat page wiring and explanatory copy. Create and update docs/handoffs/app-structure/worker-c.md first. D owns read helpers/types and publishes signatures in worker-d.md; start independent layout/copy while awaiting that contract. Preserve personal vs owner-read-only status, incoming/outgoing request semantics, archive/shared pagination and explicit reads. Request shared CSS from A and tests/read changes from D. Do not spawn workers, switch/pull/reset/stash branches, stage/commit/push, deploy, whole-format the checkout, or start builds/test/dev servers without a coordinator runner grant. Stop after two failed fixes to the same defect and report evidence before a third. Complete your owned work and record dependencies/checks.
```

### Terminal 4 — D

```text
Work in /Users/jonasal-taher/code/Jonas-09/ja5801-minglo. Read AGENTS.md, docs/APP_STRUCTURE_PLAN.md and docs/handoffs/app-structure/coordinator.md. The user approves this plan. Confirm coordinator status READY and branch feature/app-structure, then implement D only: authorized direct/Home reads, selected-agent filtering, participant/request classification/counts and regression coverage. Create and update docs/handoffs/app-structure/worker-d.md first; publish exact helper signatures/types early for C. Preserve reader locks, current-access rechecks, archive/order and per-account read positions. Prepare real Topics-off server/browser configuration and the plan's privacy/priority/filter/mobile regressions. You also own the two restart scripts only within the coordinator's assigned scope. The runner is withheld until explicitly granted after integration; do not reset DBs, migrate/install/generate clients, start servers, typecheck/build shared artifacts or run suites before scheduling. Do not spawn workers, switch/pull/reset/stash branches, stage/commit/push, deploy or whole-format the checkout. Stop after two failed fixes to the same defect and report evidence before a third. Finish services/tests preparation and report implementation readiness separately from unrun verification.
```

## Progress check 1 — November 12

- Read the saved A/C reports and inspected the shared checkout on `feature/app-structure`, HEAD `a73c282`. At the initial snapshot, only the two new report files were untracked; application code was still unchanged. This is an observation at check time, not a claim that active workers remain idle.
- A has claimed ownership and published the exact shell key contract. C has claimed ownership, documented test requirements and is preparing independent UI/copy. Neither report claims implementation completion or runtime checks.
- No B or D progress file exists yet; their terminal status cannot be inferred. Jonas should resume those existing terminals to create their records rather than start duplicates. D’s read contract is the main dependency for C.
- Clarified the existing zero-based Messages pagination contract above, including compatible explicit page 0 and canonical first-page links. B/C/D should read it before query/return-path wiring.
- Runner remains **NOT GRANTED**, integration **NOT READY**. No tests/builds, app-file edits, commits, deployment or ownership takeover were performed by this coordinator during this progress check.

## Progress check 1 — follow-up during the same review

- B and D reports appeared while the initial check was in progress: **all four workers have now claimed their assignments**. The earlier “missing report” snapshot is superseded; do not start or restart any duplicate worker. No user action is needed to launch B/D again.
- C’s first application edits are visible in its owned guide, Public chat and owner-progress files. The inspected changes stay within C’s ownership. Workers remain in progress; no worker has reported final completion.
- D published the fifth optional `agentId` argument on `listDirectChats`, `SelectedDirectAgent`, `DirectChatList` with separate incoming/observed counts, an invalid-filter error and Home incoming/personal/observing groups. This satisfies the dependency needed for C to proceed with wiring; it is not proof that the implementation exists yet.

### Contract review requests for D and C

1. **D — correct the proposed status type before final wiring.** `prisma/schema.prisma` defines `DirectRequestStatus` as PENDING, ACTIVE, DECLINED **and CANCELLED**. The handoff currently omits CANCELLED. Prefer the generated Prisma enum/type, or explicitly retain all four states. Do not drop cancelled history or cast it away merely to satisfy a narrower type. Keep pending-only requestDirection semantics and existing request/archive behavior. This is a read-contract correction, not authorization to change request mutations.
2. **C — consume D’s published interface**, including `incoming` separately from other personal Home returns; catch invalid agent-filter errors with generic notFound and never broaden the list. Display observed-request counts separately from decision counts and preserve actual participant precedence. Read D’s status-type correction before finalizing related status rendering.
3. **B/C/D — retain the agreed zero-based pagination** and consistent query validation. An explicit selected-agent filter must be validated even on Messages → Updates, where no chat list may render; switching view cannot bypass current-ownership validation or silently turn the selected view into an unfiltered fallback. Coordinate any additional context/count helper through D’s published contract.
4. **D — preserve the existing four positional callers.** Additional return fields are additive. Home selection must run before bounds, with separate disjoint groups and stable tie-breaking; no read acknowledgments, subscription writes or permission changes.

These are requests through the saved records. The coordinator has not edited worker-owned production/test files or asserted cross-terminal message delivery. No failed-fix threshold is reported in any worker record. **Runner remains NOT GRANTED; integration is not ready for acceptance testing.**

## Progress check 2 — November 12

All four workers remain active, with no reported failed-fix loop or ownership conflict. No worker reports final completion. The app-structure changes are uncommitted on the shared branch as intended. No test/build/DB/server command was run by the coordinator during this check.

- **A:** exported shell keys now exist in source. A’s resumed record says the full role-aware shell, canonical Topics/discovery navigation and styling are still being implemented; do not mistake the key declaration for completion.
- **B:** actual source now includes `/agents`, the own-profile split, extracted disconnect control, room filter transaction/selected-Agent lock, participation anchors, action invalidations and narrow return validation. The progress record has not yet enumerated those changes; B should update actual files and explicitly report readiness when finished.
- **C:** Home/dashboard, return-link component and local Home CSS are being implemented, together with guide/Public chat/owner-progress copy. C accepted D’s helper contract and zero-based pages; final Messages wiring is not yet complete.
- **D:** authorized direct-list/Home services are available for C. The initial status omission is **resolved in source and handoff**: `DirectChatItem.status` now uses Prisma’s `DirectRequestStatus`, including CANCELLED. New read/filter fixtures and tests plus a standalone Topics-off config are present; runtime checks are correctly marked unrun.

### Decisions / requests from this review

1. **C — Updates semantics accepted.** Selected-agent context filters direct Chats/Requests. Updates can remain explicitly labeled as activity for the signed-in account, provided the supplied agent filter is still authorized on every request (including Updates), the distinction is visible beside the context, and agent navigation context is retained. Do not filter a first page of attention as though it were a complete agent feed. No new filtered-attention service or permission change is required for this plan.
2. **D — make the Topics-off page assertions match installed Next.js semantics.** `tests/e2e/app-structure.topics-off.spec.ts` currently requires HTTP 404 for every unavailable page. The existing production restart check and installed Next.js guidance already document that request-time notFound can stream unavailable UI with HTTP 200. Assert the unavailable heading/body and noindex plus absence of gated content, accepting only the documented 200/404 page outcomes; keep the topic API’s actual 404 assertion. This is not permission to weaken authentication or content-suppression checks. Verify the true served UI, not status alone.
3. **D / coordinator — preserve final default-suite fixtures for restarts.** The off config currently defaults to the same `minglo_test` database and resets it. Merely serializing the two servers does not preserve full-suite fixture prerequisites. Before the runner grant, choose either a deliberately separate Topics-off `_test` DB via `TEST_TOPICS_OFF_DATABASE_URL`, or run the off suite **before** the final full default suite. Do not reset its fixtures between that full run and `test:restart`. Run legacy restart before topic restart. Keep `.next` and servers serialized regardless of database choice. No runner is granted by this note.
4. **B/C/D — archive/query alignment still applies.** Preserve compatible page 0–200, drop pagination on view/filter changes and keep `agent` on navigation. The pure return-path validator checks shape, while routes/read services must check actual current ownership. Unknown or duplicate agent filters must not broaden results.

Next gate: A, B and C explicitly report their implementations complete; D reports read-service/test preparation complete; coordinator reviews the combined wiring and any outstanding requests. Only then grant the runner and stop/clear the existing preview. **Integration remains NOT READY; runner NOT GRANTED; no deployment.**

## Progress check 3 — B completion confirmed

- **B now explicitly reports IMPLEMENTATION COMPLETE**, ready for coordinator integration and D verification. This supersedes the previous in-progress snapshot. Do not restart B or invent more B feature work; B retains file ownership and remains available for concrete validation failures.
- B reports scoped diff/Prettier checks, memory-only syntax transpilation and safeNext assertions (23 accepted / 33 rejected). These are source-only checks, **not** semantic typecheck, browser security tests or rendered acceptance. The coordinator did not rerun or upgrade those claims.
- Coordinator inspected the new human-only `/agents` route and agent redirect, four exact card links, own-profile split, preserved disconnect disclosure/confirmation, authorized-list participation anchors, selected-room filter intersection/Agent lock and affected revalidation paths. No additional B implementation blocker was identified in that limited source review; D still needs to exercise them at runtime. Whole shared diff whitespace check passed. No migration/dependency/frozen layout or theme-component diff was present in the inspected snapshot.
- **A remains implementing**, with full shell/Topics/discovery source changes now visible and final owned-file source review pending. **C remains implementing**, with Home and Messages wiring now visible. **D is preparing tests and legacy expectation updates**, with read services available. None of A/C/D has reported final implementation/preparation completion in the records read for this check.

### Narrow ownership approval for A

A requested an optional contextual breadcrumb alignment in `src/components/discussion-panel.tsx`, currently outside its listed ownership. **Approved and assigned exclusively to A**, limited to replacing the existing live topic-name paragraph with the existing-style `topic-navigation` nav: Topics → live topic name → Discussion. Keep the current live topic metadata, URLs, launch gate and all reader/polling/reply/report/read controls unchanged. No duplicated static title or new query. A must record whether it applied this change before final readiness; D includes it in nested discussion navigation checks. This is a scope-preserving markup assignment, not a general ownership transfer of transcript behavior.

Runner remains **NOT GRANTED**, integration **NOT READY** until A/C implementations and D test preparation are explicitly ready and the combined wiring is reviewed. B completion alone is not a full-app acceptance or a reason to run tests while other workers edit. No commits, worker replacements or deployment were performed during this check.

## Integration handoff — progress check 4

A and C now explicitly report implementation complete; B remains complete; D explicitly reports service/test preparation complete. None claims runtime acceptance. Source review confirms D’s Messages bracket-query finding is already resolved by C’s closed-key route validation; the room route still needs it.

**Temporary exclusive ownership transfer to coordinator, effective before edits:**

- `src/app/conversations/page.tsx`: add closed-key query rejection before authentication, preserving B’s owner/Agent validation, reader predicate, locks and UI. B must not edit this file until the narrow integration patch is complete or reassigned.
- `src/app/inbox/page.tsx`: align the already-agreed archive/tab convention only: archive state applies to Chats, and non-Chats tab links omit it. Preserve C’s existing agent validation, counts and shared pagination. C must not edit this file during this patch.
- `src/components/discussion-panel.tsx`: coordinator takes back the previously granted **breadcrumb-only** lease from A because A has completed its work without applying that optional markup alignment. Add Topics → existing live topic name → Discussion using A’s prepared styles, without touching reader state, URLs, polling or action controls. A must not apply a competing patch.

No other worker file ownership transfers. The coordinator will finish these small integration edits, inspect the combined contracts and then publish the exact D runner lease. Runner remains withheld during integration. App source remains uncommitted and no deployment is authorized.

## COMPLETED VERIFICATION LEASE — progress check 4 (historical)

**Granted to the existing D terminal only.** A/B/C have explicitly completed implementation; D has explicitly completed services/test preparation. Combined source wiring was reviewed, including published types/callers, pagination/filter semantics, current-owner room predicates, source/gate navigation and pending regression contracts. This is readiness for testing, not a claim of acceptance.

### Integration edits completed before grant

- `src/app/conversations/page.tsx` now rejects every query key except `agent` before sign-in/read handling. This closes the confirmed bracket-key unfiltered fallback. C already had the corresponding closed-key guard on Messages.
- Messages now treats archive as Chats-only and omits it from non-Chats tab links, retaining selected-agent context and page-reset behavior.
- Discussion navigation now uses A’s prepared breadcrumb styles for Topics → the existing live topic name → Discussion, without changing transcript behavior or duplicating topic metadata.
- Scoped Prettier check on those three integration files and shared diff whitespace checks passed. No runtime or semantic check is claimed by the coordinator. These are first integration patches, not repeated failed fixes.
- Narrow route leases return to B (`conversations/page.tsx`) and C (`inbox/page.tsx`) for **requested validation fixes only**, after reading these final changes. They must not edit during an active D command; D stops/releases the runtime phase first. The finished breadcrumb file remains coordinator-owned; A must not apply its earlier competing optional patch.

### Runtime clearance and freeze

- Shared checkout/branch: `/Users/jonasal-taher/code/Jonas-09/ja5801-minglo`, `feature/app-structure`. HEAD is `a73c2820221d37022b3067ad82c1bf0d78048346` plus the uncommitted integrated worker changes and three coordinator integration edits. No worker changes have been staged or committed. Ignored `.local/app-structure/verification/integration-manifest.json` records source/test hashes at this grant.
- Coordinator verified the reserved preview PID 41672 belonged to this checkout and stopped it. A follow-up inventory found no listeners on **3001, 3100, 3105 or 3106**. D owns `.next` and all scheduled test/server/build activity until completion or explicit release. Recheck ports before starting; never kill an unrelated process or delete a lock belonging to a live server.
- A/B/C are in waiting/available-for-findings state. No app/test edits, formatting, install/generation, build, migration or independent server/suite command by any other terminal during D’s run. No new dependencies, Prisma schema changes, production action or deployment.

### Exact resources

- Enabled tests / focused tests / final full suite / legacy restart / topic restart: `TEST_DATABASE_URL=postgresql://minglo@127.0.0.1:55432/minglo_test?schema=public`. This is disposable; reset only through the scheduled test configuration. Enabled app uses **3100**; legacy restart also uses 3100 after the suite stops. Topic restart uses **3105**.
- Topics-off tests: `TEST_TOPICS_OFF_DATABASE_URL=postgresql://minglo@127.0.0.1:55432/minglo_topics_off_test?schema=public`, app **3106**. D may create this named loopback-only disposable DB if absent using installed local PostgreSQL tools; do not create paid resources or reset `minglo`. The off configuration itself applies/resets committed migrations in that disposable DB.
- `.next` remains shared: all commands below run sequentially even though the databases differ. Do not borrow the preview or reuse an old running app. Do not let a different `_test` environment silently replace these named resources; record any necessary reassignment first.
- D may write ignored logs, original screenshots and evidence under `.local/app-structure/verification/` and `.impeccable/review/app-structure/`. Do not place credentials, cookies or claim links in records. Preserve off-mode captures **outside** `test-results/` before starting the final enabled full suite; its output cleanup can remove nested off-mode output.

### Ordered acceptance commands

Run from the shared root. Check each result before continuing; do not chain past a failure.

1. `npm run typecheck`. Route failures to the owning worker; D may fix its own service/test/configuration files only.
2. With the enabled `TEST_DATABASE_URL` above: `npm test -- tests/e2e/app-structure-reads.spec.ts tests/e2e/app-structure-ui.spec.ts`. Exercise the new contracts first. Record named failures and exact partial results.
3. With the off `TEST_TOPICS_OFF_DATABASE_URL` above: `npx playwright test --config=playwright.topics-off.config.ts`. Both runner and actual app must remain false. Preserve valid off captures/logs outside default test output after the server stops.
4. With the enabled `TEST_DATABASE_URL` above: final default **`npm test`**. This recreates all legacy/default regression fixtures; preserve them through the restart checks. Do not reset this DB afterward.
5. `npm run build` after every test/dev server has stopped. Do not start another dev server after this build and before persistence checks.
6. With the same enabled `TEST_DATABASE_URL`: `npm run test:restart`, then, after its server stops, `npm run test:topics:restart`. Keep that order; do not reset between them. If prerequisites are missing, report the real fixture/setup issue rather than weakening persistence assertions.
7. Review all captured desktop/320/360 enabled/off navigation states in both roles/themes, More open/closed, long names, keyboard/focus/touch targets and the changed Home/Messages/profile/agent surfaces. Existing prepared tests supply evidence; use this same exclusive lease for any necessary additional scoped rendered check. Record only what was actually exercised. Preserve full originals and a viewport/state manifest for the later independent review.

The full default suite is required by the approved plan. If a genuine environment-specific limitation appears, document it and request a concrete scheduling/test approach rather than hiding/skipping it. Previously known production-vs-development error-detail behavior is not authority to weaken security assertions. Do not repeat an entire passing suite absent a new change/failure that justifies it.

### Failure handling and handback

- Stop the active command/server before handing another owner a fix. Save defect, owning file, evidence, attempted fix counter and precise resume request. Source ownership does not transfer to D by implication. Reacquire the runtime only after the fix is recorded and the source is re-read.
- After **two failed fixes of the same defect**, stop and ask Jonas before a third. Do not rename issues, replace workers, silently retry a third patch, loosen assertions or skip required checks. Unaffected read-only preparation may continue.
- Update `worker-d.md` with exact commands, counts/results, captures/manual checks, pending limitations and whether the lease remains active. Runtime UNRUN statuses become passed only with actual evidence. D does not commit, push, deploy or claim a real Muse/host-autonomy result.
- When verification finishes, stop only D-owned processes, leave `.next`/DB evidence intact, and release the runner in `worker-d.md`. Coordinator then reviews results, updates its product/design/surface documentation against actual evidence and schedules the later independent review.

Jonas should resume **the existing D terminal**, not start another worker, with: “Read the ACTIVE VERIFICATION LEASE in docs/handoffs/app-structure/coordinator.md. Integration is ready and you have the exclusive runner. Execute its ordered checks, preserve evidence and follow its ownership/two-failed-fixes rules. Update worker-d.md. Do not deploy.”

## Progress check 5 — D verification accepted as evidence

D explicitly released the runner after the ordered checks. The coordinator read the final report, inspected actual passing log summaries and the synchronization-test diffs, independently verified all 53 verified-file hashes against the current tree and all 168 final screenshot-original hashes, and reviewed representative navigation, populated Home and own-profile images. No app/test source was changed after D’s verified snapshot. No listeners were found on the leased preview/test ports.

- Full default: **115 passed**, zero skips/no configured retries; separate actual Topics-off run: **2 passed**. These are **117 distinct suite cases**; the passing focused 15 are a subset of the default suite. Typecheck, build and both production persistence checks passed.
- Supplemental production checks: 72 page variants, zero overflow/pageerror failures; two role keyboard/focus checks and two synthesized-touch checks passed. The evidence is local, not physical-device/screen-reader proof or a real Muse return.
- Initial failures and first successful synchronization fixes are preserved in D’s report/logs; none reached the two-failed-fixes threshold. The coordinator reviewed the changed waits/sequence assertions; no required/security/history check was removed.
- **Open review item:** 320px Messages and Manage participation can wrap mid-word. It is recorded for independent judgment, not hidden by passing behavior checks or patched before a fresh review. Primary detector findings are zero; 23 inherited-token advisories and stale sidecar limitations remain documented.
- Coordinator updated PRODUCT.md, DESIGN.md prose, AGENTS.md, the implementation plan status and Home/Topics surface briefs to describe the implemented routes, profile split, bounded/classified returns and actual verification. Tokens/sidecar and all production/test source stayed unchanged, so no redundant runtime rerun was started. The original Home ship record is explicitly historical, not a verdict for this extension.
- New `docs/handoffs/app-structure/review-brief.md` supplies the separate reviewer’s exact read-only scope, original evidence paths, known limitations and five-section disposition/report contract. A–D remain complete and idle unless a concrete finding is assigned.

**Next:** Jonas opens one fresh independent review terminal with that brief. Do not spawn a duplicate worker or infer that this coordinator has performed the independent review. After `review.md` exists, coordinator resolves material findings with explicit ownership and the existing failed-fix rule, then makes focused Git commits/integration. App-structure implementation remains uncommitted at this checkpoint; no push/merge or deployment of this work is claimed.

## Independent review received — F1 correction lease

`review.md` returns **fix** for F1 only: fixed navigation words fragment at supported 320/360px widths, including Topics-off More. F2 (inherited room-card title collapse) and F3 (inherited observed Home aggregate-link destination) are documented follow-ups, not additional holds. No P0/P1 or new authorization/privacy regression was identified in the reviewed scope.

**Coordinator exclusively takes the narrow F1 edit/runtime lease:** `src/components/app-shell.css`, the navigation-only rules in `src/app/side-by-side.css`, and `tests/e2e/app-structure-navigation.ts` for an actual rendered word-integrity assertion. A and D must not apply competing changes. All other production/tests remain frozen. No test database reset, domain/query/permission change, new dependency, deployment or broad visual redesign is authorized.

Plan: add a DOM-range regression that detects a fixed label word spanning multiple rendered lines; demonstrate it against the existing verified build; give primary labels sufficient horizontal room and make the narrow More arrangement retain whole words without shrinking/hiding/truncating text. Build/typecheck, rerun the shared navigation assertions read-only against retained local fixture accounts in production for both roles/themes, 1440/360/320 and both gate states, and preserve all 48 original open/closed captures. Then request the same independent reviewer’s verdict on F1’s corrections only. The earlier full 115 + 2 behavior runs remain evidence for unchanged domain source; do not claim they were rerun after a CSS correction.

F1 application-fix attempt: **1 planned; no failed fix yet**. If verification fails, diagnose and record before a second approach; after two failed fixes stop and ask Jonas before a third. No extra detector run is needed; the review identified the precise fix.

## F1 correction result — targeted verification complete

The new word-integrity assertion failed against the old production artifact as expected, independently reproducing the review hold. One CSS correction batch then passed: normal whole-word shell wrapping, mobile primary cells without unnecessary inline padding/gaps, and one full-width column in mobile More with the existing scroll-height bound. No font reduction, truncation, content hiding, destination change or theme change.

`npm run build` and `npm run typecheck` passed. The actual shared navigation helper, strengthened with DOM-range word/target assertions, passed on the corrected production artifact for all **48** original role/gate/theme/viewport/menu states. Four role/gate executions, no page errors; all previous navigation, gate, target, keyboard/focus and overflow assertions retained. Local retained fixture accounts were used with no DB reset. The coordinator hash-verified all 48 originals and confirmed that exactly the three assigned F1 app/test files differ from D’s verified snapshot. All other verified app/test/config files match. First correction succeeded; failed-fix counter stays **0**.

Evidence: ignored `.local/app-structure/f1/` baseline failure, fresh `final/` originals/checks, source manifest and build/typecheck/final logs. Coordinator inspected representative full 320/360px and desktop originals, including expanded single-column menus in both themes/gates. No further own defect hunt/detector run or broad suite rerun was performed. The original 115 + 2 suite and both restart passes predate this CSS-only correction; current passing targeted evidence is reported separately.

**Runtime lease released**: script-owned browsers/processes stopped; no further source edits pending the scoped verdict. DESIGN.md now describes the corrected arrangement and pending verdict. Original `review.md` remains unchanged with F2/F3 inherited follow-ups. `review-f1-brief.md` contains the precise correction/evidence packet for the same reviewer, who writes only `review-f1.md` and scores F1. Git integration and deployment remain withheld; no deploy is authorized.

## Final acceptance — Git integration

Jonas returned the independent scoped verdict: **F1 resolved / disposition ship**. The coordinator read `review-f1.md`, independently matched all 53 current source/config/test hashes and all 48 final capture hashes, and confirmed no app listener was running on the leased ports. The original review remains untouched. Its sole required correction is resolved; F2/F3 stay in the follow-up record and are not declared fixed.

Validation timing remains explicit: 115 default + 2 actual Topics-off cases and both restart checks passed before the CSS-only F1 correction; renewed build/typecheck and all 48 shared-navigation states passed afterward. No business/access source changed during the correction, no assertions were weakened and no redundant full rerun was claimed. No failed-fix threshold was reached.

The coordinator is now creating focused source, coverage and documentation commits on `feature/app-structure`, then pushing and merging that branch into main with a merge commit according to the owner’s existing Git tracking preference. No schema/dependency change, production data operation, resource change or deployment is included. Worker and reviewer reports are retained as execution evidence; ignored logs/full originals stay local. Product/design/plan/surface documentation now records the implemented structure and scoped verdict.

## Deployment authorization — supersedes the initial no-deploy boundary

Jonas explicitly asked: “Can you just work through all pending commits / merges and deployment so I dont have to copy paste all the time lol”. This authorizes the coordinator to finish focused commits, push/merge the reviewed branch and deploy the existing Heroku app without another approval/copy-paste step. It does not authorize credential rotation, paid resources, new features or weakening checks. Earlier no-deploy statements in historical worker/reviewer records apply to those earlier scopes, not to this current coordinator instruction.

Current preflight: Heroku v27 runs `496dd453` with Topics enabled. This release will include the already-pushed theme/loading baseline as well as the reviewed app-structure changes. No schema or dependency changes are present; 20 existing migrations are expected. Standard backup is being captured before release. Exact deployed source, release and hosted checks will be recorded after the operation actually succeeds.

## Final hosted release — November 12, 2026

The owner-authorized release is complete. Focused app/test commits were pushed on `feature/app-structure`, then merged into GitHub main with merge commit **`4b8250a`**. The existing `minglo-ja5801` app deployed that exact source successfully as **Heroku v28**. Remote build/typecheck passed; release-phase Prisma found **20 migrations and none pending**. Backup **b009** completed before release. `web.1` is up and `MINGLO_TOPICS_ENABLED=true` is unchanged. No paid resource, dependency, credential or schema change was introduced by this release.

Read-only live Chrome checks passed: database health 200/ok; exact sign-in continuation for `/agents`, `/profile?edit=1`, filtered rooms, filtered Requests with pagination, filtered archived Chats and topic creation; canonical temporary legacy Topics destination retaining followed/cursor values; malformed bracket filters return unavailable/noindex rather than broad lists; signed-out Public chat/direct/topic APIs return 401/private-no-store; fresh dark-device context starts light, the 64px switch keeps its 44px target and saved dark mode persists after reload. No page errors, production fixture accounts, posts or host tasks were created. Authenticated participation journeys were verified locally; no real hosted participant/Muse trial is claimed. Ignored live evidence: `.local/app-structure/deployment/hosted-access.json`.

All required implementation work, validation, independent F1 verdict and this rollout are complete. F2/F3 remain inherited nonblocking follow-ups in `follow-ups.md`. The release-note updates are documentation only; they do not require another application deployment. No active worker/test lease remains, and the reviewed implementation branches stay on GitHub for tracking.

## F2/F3 follow-up — separate release scope

Jonas requested “fix it and deploy please” for both inherited findings. F2 now scopes wrapping to Agent rooms' Public chat card, reserving 12ch for its title before audience/unread badges wrap. F3 derives Home aggregate destinations from the displayed request kinds: pending observed requests go to Requests, active exchanges to Chats, mixed groups expose both. Personal outgoing introductions retain Chats. No database/query, authorization, ownership, count or read-position behavior changed.

Before correction, four new browser cases failed for the reported defects, while the active-only control passed. The first app correction passed all five focused cases, including 24 viewport/theme captures. No failed app-fix attempts. The active Impeccable hook requires no additional detector pass; the existing Side by Side tokens, typography, themes and 44px action targets are preserved.

Concurrent navigation edits were detected while preparing the first commits. Jonas approved parallel work. The shared checkout and its pending navigation changes were preserved; a clean release branch `fix/app-structure-follow-ups-release` was reconstructed in `/private/tmp/minglo-follow-ups-20261112`, explicitly excluding the other session's navigation CSS. Its three focused source/test commits are `37ef369`, `5c383ed` and `7428038`, pushed to GitHub. Local test databases `minglo_followups_test` and `minglo_followups_off_test` keep fixtures separate. Runtime/deployment ownership is recorded in the shared follow-up coordination record.

An initial shared-checkout full run was stopped when concurrent edits were discovered. A fresh isolated development-server run then encountered two pending-request/time-budget failures in existing conversation tests; traces were retained. No assertion or timeout was changed. The installed Next.js Playwright guide recommends production-code testing, so release verification uses the completed production build and the unchanged full suite through ignored local config overrides. The overrides preserve browser, one worker, cases, timeouts, retry policy and database-reset guards; only server startup changes from dev to start (and explicit config cwd/path resolution). The first override launch failed before tests because cwd pointed at the config subdirectory; explicit cwd fixed that setup error. Build and typecheck passed. Final suite, render, persistence and hosted results follow only after they actually complete.

The first complete production run finished **118 passed / 2 failed**: one assertion expected Next's development-only detailed Server Action diagnostic although production correctly returned 500 with an error digest; the last case exhausted the real 100-attempt source budget because all fixture sign-ins shared one simulated client IP. These were test-harness problems, not changes to application behavior. The diagnostic assertion now supports the documented production digest while retaining HTTP rejection and adding a full unchanged-conversation/history comparison. Browser auth helpers now supply a stable benchmark-range test source per fixture handle through the already explicitly trusted test router. Dedicated attacker/victim throttling contexts and every application limit remain unchanged. Original logs/traces were preserved. A fresh complete production run is verifying both corrections; no cases, assertions, retries or timeouts were removed or relaxed.

### Final local verification — F2/F3

The fresh full production run passed **120/120**, no skips/retries. Separate actually served Topics-off checks passed **2/2**, making 122 distinct passing suite cases. Both development timeout cases passed in production, and both test-harness corrections passed their first verification; no app or harness fix reached the two-failed-fixes threshold. Final typecheck passed. The production build predates only test/documentation edits; all four changed application files remained unchanged through final verification.

Both actual production persistence checks passed against retained isolated full-suite fixtures. Supplemental production verification passed 24 page variants (owner Home and both roles' unfiltered Agent rooms, 320/360/768/1440, both themes), with no overflow or page errors. Public chat title words remained whole beside populated audience/471-unread badges; Home mixed-group links retained their correct destinations, 44px targets and visible keyboard focus. Both roles passed additional keyboard and synthesized-touch checks. The coordinator inspected representative originals covering every tested width/theme and both rooms/Home paths. Scoped coordinator verdict: both follow-ups resolved and ready to ship; no new independent review or physical-device/screen-reader/Muse proof is claimed.

Evidence remains ignored in the isolated checkout's `.local/follow-ups/`: baseline/focused evidence in the original checkout, retained interrupted/first-run traces, final `production-full.log`, `topics-off.log`, `build.log`, `typecheck-final.log`, `restart.log`, `topics-restart.log`, and `production/` originals/checks. Existing backup **b010** completed before release. GitHub main remains `284af0c`. Heroku advanced independently to config-only v29 (AUTH_URL now `https://www.minglo.club/`); its application code remains the previous v28 source. This release preserves that config and Topics=true, with no schema/dependency/resource/credential changes.

### Hosted follow-up release complete — November 12, 2026

The focused branch was merged with `--no-ff` into GitHub main as **`4518bdc`**, pushed, and deployed successfully to the existing Heroku app as **v30**. Remote build/typecheck passed. Release output confirmed **20 migrations / none pending**; backup b010 was already complete. The web process is healthy. No schema, dependency, resource, credential, AUTH_URL or Topics-flag change was made by this release.

Read-only live Chrome checks passed on the established Heroku host: database health; six exact sign-in continuations; canonical legacy Topics redirect; unavailable/noindex for malformed filters; all three signed-out private APIs denied; default light theme, fixed 64×44 theme target and saved dark choice; no page errors. No production fixture account, message, host task or authenticated-user journey was created/claimed. Authenticated functional and visual checks remain the local 120+2 suite and production-render evidence above.

The other domain session independently changed AUTH_URL to `https://www.minglo.club/` in config-only v29. The first live custom-domain request hit a Squarespace self-redirect loop. Jonas confirmed that domain setup was complete and awaiting DNS propagation. Read-only checks then confirmed the distinction: the local resolver retained the old Squarespace CNAME, public resolver 1.1.1.1 returned the configured Heroku CNAME, and direct HTTPS to the existing Heroku custom-domain endpoint returned health `ok:true` with valid TLS. Settings were left untouched. The trial browser still needs the propagated DNS and a real sign-in check; real Muse autonomy remains unverified.

F2/F3 are resolved and deployed. The separate permanent-Public-chat navigation work and all original-checkout changes remain preserved for its own session. All coordinator-owned browsers/test servers have stopped; the test-server and Heroku deployment leases are released. Documentation-only release records do not require another application deployment.
