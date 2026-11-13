# App structure coordinator

Date: November 12, 2026 (America/New_York).
Mode: **four independent worker terminals A–D sharing one checkout**. No spawned or duplicate workers.
Scope: the owner approved `docs/APP_STRUCTURE_PLAN.md` and its multi-file implementation. **Do not deploy.**

## Launch status

**READY — launch exactly one worker in each of terminals A, B, C and D.** All use `/Users/jonasal-taher/code/Jonas-09/ja5801-minglo` on the same **`feature/app-structure`** branch. No worker has been spawned by this coordinator. Jonas launches the independent terminals using the prompts below; each worker records its actual start in its own report.

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
| Coordinator | This record, `docs/APP_STRUCTURE_PLAN.md`, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/**`, other project documentation and final integration. `src/components/theme-toggle.tsx`, `src/app/layout.tsx` and the intentional absence of root `src/app/loading.tsx` remain frozen as incoming baseline; changes require explicit reassignment. `package.json`, lockfile, shared components not listed above, and core write/claim/pause/moderation services remain unassigned/frozen unless a specific need is reviewed. |

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

## D → C read contract and selection requirements

D publishes exact exported signatures/types in `worker-d.md` **before** C wires the read results. The coordinator is not inventing a competing helper interface. Preserve current caller compatibility where practical. C reads the published contract at each dependency boundary and records agreement/questions in `worker-c.md`.

Required semantics:

- Optional selected-agent filtering is authorized inside the read path, including current-owner validation and private-preview rechecks under existing reader locks.
- Each row provides personal participant versus current-owner read-only classification; pending personal requests distinguish incoming from outgoing.
- Requests tab's decision count includes actionable incoming personal requests and the viewer's own agent-room invitations; owner-observed requests have a separate read-only count. Outgoing personal requests remain in Chats. Counts and lists share access/filter predicates.
- Home selects **before list limits**: at most three actionable incoming personal requests, three other personal returns (unread/unmuted active or outgoing pending), and three owner-readable agent returns/requests. More than 30 recent observed chats must not crowd out an older personal request. Stable recency/ID ties, no repeated conversation IDs across groups, participant status first. Discussion returns stay separately bounded.
- None of these queries acknowledges read positions, subscribes a viewer, changes archives or expands read/post/decision permissions. No schema migration or dependency is expected.

## Shared resource / runner lease

**Runner: NOT GRANTED. Integration: NOT READY.** No workers may start builds, dev/production servers, DB-resetting tests, migrations, installs or Prisma generation. Do not run whole-tree formatting, stage/commit/pull/reset/stash/switch branches, or push/deploy. Coordinator owns Git mutations. Read-only source inspection and checks limited to owned files that do not mutate shared generated artifacts are permitted; record their scope.

D prepares test cases/configuration now, including a dedicated real Topics-off app environment and exclusion of its off-only tests from the enabled run. Service-only environment toggles do not prove served pages use the disabled flag. All reset targets must end in `_test`; no production or existing development DB reset.

When granting the runner, coordinator records: A–D integration completion, current HEAD/working diff, named database(s), URL/ports, `.next` owner, preview stop/clearance, ordered commands, and whether fixes require returning the lease. D does not run just because another terminal appears idle. No concurrent servers/builds sharing `.next`; isolate database, ports **and** build directory deliberately or serialize them.

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
| Shared branch and launch | READY | `feature/app-structure` based on pushed `d5783d6`. Jonas starts the four independent terminals; no duplicates spawned. |
| A | Not launched | Publish shell keys; own navigation/Topics/discovery and shared navigation CSS. |
| B | Not launched | Separate own profile/My agents; cards/anchors, room filter, action refresh and safe return paths. |
| C | Not launched | Begin independent Home/Messages/copy; consume D's published read contract for final wiring. |
| D | Not launched; runner withheld | Publish read contract early, implement authorized read changes and prepare tests. |
| Independent review | Not started | Later separate terminal after integration; no competing editing/testing. |
| Deployment | Prohibited | User explicitly said do not deploy. |

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
