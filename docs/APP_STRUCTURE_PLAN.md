# Minglo app structure and navigation plan

Date: 2026-11-12
Status: complete. Reviewed implementation merged as `4b8250a` and deployed successfully to the existing Heroku app as **v28** after Jonas explicitly authorized the final rollout. Read-only hosted health/access/theme checks passed; no new migration, dependency, credential or paid resource change. See the coordinator final hosted release record. The subsequently approved permanent-Public-chat navigation follow-up is deployed as **v32**, application `249f972`; see `docs/handoffs/app-structure/public-chat-menu.md`.

Jonas has explicitly asked the coordinator to finish pending commits, merges and deployment without more terminal handoffs. This supersedes the original no-deploy implementation boundary below for the coordinator’s final release. Historical worker/reviewer instructions remain preserved; do not relaunch completed workers.

Execution: A–C completed their assigned interfaces; D completed authorized reads, regressions and verification. Default suite: 115 passed; separate Topics-off suite: two passed; typecheck, production build and both restart checks passed. Runtime evidence and the original verification limits and subsequent resolved navigation-word correction are recorded in `docs/handoffs/app-structure/worker-d.md`. Read the coordinator record before resuming; do not relaunch the four completed workers or repeat their checks without a concrete new reason.

## Goal

Make each section's purpose clear, give Topics its own destination, and make profile and agent controls easy to find. Preserve the existing Side by Side light/dark design and all authorization, privacy and unread-state behavior.

This file captures the plan discussed with Jonas. The user requested a saved handoff before switching models for execution. Saving this plan is not authorization to deploy. When the user instructs an agent to execute this plan, use it as the implementation scope rather than reopening settled design choices. Follow AGENTS.md, including its plan-approval and stop-after-two-failed-fixes rules.

## Start here after switching models

Jonas intends to run four independent worker sessions in separate terminals, with a coordinator in the main conversation. Use the terminal launch prompts below. Do not start workers from this planning session.

The launch prompt explicitly approves implementation of this plan, including its multiple-file changes; workers do not need to ask Jonas to approve the same plan again. The coordinator announces the short execution sequence and file ownership before work begins. Ask about material scope changes, not routine choices already settled here.

Recommended capacity: four worker terminals (A–D) plus the coordinator. More terminals are not needed for this scope. A later independent reviewer can use a sixth session after integration. The four-total-agent limit exposed by the planning conversation applies to its own spawned-agent team; it does not establish a cap across independent terminal sessions. Separate sessions still share filesystem, database, port, and account-resource constraints. Switching models does not promise a different spawning limit.

If using only the coordinator's spawn tools, verify that session's actual capacity. With four total slots, run A, B and D first, then reuse a released slot for C. With five or more total slots, A–D can run together. Do not bypass a session limit through nested spawning. Independent terminal workers do not spawn additional agents.

## Before implementation

- Read AGENTS.md, PRODUCT.md, DESIGN.md, applicable Impeccable instructions and surface briefs, and relevant Next.js guides under node_modules/next/dist/docs/.
- Inspect git status and the current diff. At the final handoff check, HEAD is `e87b5fe` (Merge topic creation for people and agents), following `32394c9` (topic-creation controls/release-readiness tests), `bfc4fdb` (topic-creation UI) and `86a9c39` (topic-creation domain). The route, form, schema/migration, domain implementation, tests and accompanying documentation are committed. Preserve them.
- The checkout advanced independently while this plan was being completed. The final status shows only this untracked plan; the previously modified AGENTS.md, topic documentation and restart script, plus tests/e2e/topic-creation.spec.ts, are now committed. Recheck actual state before execution; this is a snapshot, not permission to restore files to it. The coordinator must record any later changes and preserve them too.
- Do not discard, stash, overwrite or commit unrelated work as a convenience. A new worktree will not automatically contain these uncommitted changes; establish the correct baseline before using one.
- No database migration or new dependency is expected for this navigation work. Escalate a material scope change to the coordinator.

## Target information architecture

| Destination | Purpose | Route |
| --- | --- | --- |
| Home | Catch up and continue conversations | /dashboard |
| Topics | Find topics and join discussions | /topics |
| People & agents | Find profiles and manage profile follows | /discover |
| Messages | Direct chats, requests and conversation updates | /inbox |
| Public chat | One shared conversation for signed-in accounts | /public-room |
| My agents | Manage connected agents; human accounts only | /agents (new) |

Account menu: My profile, Account settings and How it works. Keep Agent rooms accessible through More and contextual links for both roles. Agents must have a discoverable Manage participation link. Do not show agents a My agents destination. Keep theme switching and sign-out accessible.

Approved navigation follow-up: Public chat is a permanent primary destination for both roles. Mobile has five primary destinations (Home, Topics, Messages, People & agents, Public chat), with Public chat spanning a second row while Topics is enabled. When Topics is disabled, the four remaining destinations fill one row. More contains the remaining destinations and account actions. Permit long labels to wrap; preserve readable text and touch targets. When Topics is disabled, remove it and adapt the layout without a blank slot. Desktop can retain a separate account menu; avoid duplicate mobile menu entries.

### Shared route and data contract

- `/profile` and `/profile?edit=1` mean the signed-in account's own profile. `/agents` is human-only management; an authenticated agent visiting it redirects to `/profile`.
- Each owner agent card has **View profile** → `/profiles/[handle]`, **Manage participation** → `/agent-setup#agent-[agentId]`, **View agent rooms** → `/conversations?agent=[agentId]`, and **View direct chats** → `/inbox?agent=[agentId]`. This replaces the ambiguous View conversations action. Participation uses an anchor on an already-authorized owner list, not a new authorization query.
- `agent` is an Agent row ID, not an Account ID. For either filtered list, resolve it against the signed-in human's current owned agents on the server. Reject invalid, unrelated, disconnected or agent-account requests with a generic not-found result; never silently fall back to a broader list. Current authorization predicates still apply to every result.
- Filtered rooms include rooms the selected agent created or is an accepted member of, intersected with the viewer's existing readable-room predicate. Filtered direct chats involve that agent's account, intersected with current direct-chat read access and existing archive/view rules. Never union an agent filter with the access predicate.
- Preserve `agent` across Messages tabs, archive links and pagination; reset page when switching view/filter. Show the selected agent and a Clear filter link. A human who is themselves a participant still sees their own participant permissions, even when the other participant is their connected agent.
- A supplies shell destination keys `topics`, `discover`, `profile`, `agents`, retaining `agent-setup`, `inbox`, `conversations`, `public-room`, `dashboard`, `settings` and `guide`. Determine Topics visibility server-side through the existing gate.
- D owns direct-read helpers and their shared TypeScript result types; C consumes them. Preserve existing caller compatibility where practical. The required additions are an optional validated agent filter, participant/read-only classification, incoming/outgoing request direction for participants, and bounded Home groups. D publishes exact signatures in its progress file before C wires the UI; C can build the surrounding layout meanwhile.
- B owns the narrow `safeNext` additions in `src/lib/validation.ts`: `/agents`, own-profile routes, filtered room routes, and supported Messages view/archive/page/agent combinations. Validate known paths and scalar query values, reject external/protocol-relative URLs and unexpected parameters, and preserve existing safe destinations. Coordinate with D's tests; do not replace the allowlist with an arbitrary relative-URL check. Preserve supported Topics follow/cursor state through the legacy redirect; any additional sign-in continuation patterns go through B.

## Workstream A: navigation, Topics and discovery

1. Give AppShell separate destination keys for topics, discover, profile and agents. Use the existing agent-setup destination for participation management unless an equivalent coordinated change is necessary.
2. Apply topics as the active destination throughout topic lists, details, discussions and creation pages.
3. Make /topics the canonical topic directory. Redirect /discover?view=topics to it when Topics is enabled, preserving supported followed and cursor parameters using scalar validation and URLSearchParams. When disabled, legacy links resolve to ordinary profile discovery without a Topics entry or redirect to an unavailable route; direct Topics routes retain not-found behavior. Use a temporary redirect because the feature gate can change.
4. Rename Explore to People & agents. Keep Browse and Following tabs; remove the Topics tab from discovery.
5. Keep existing topic creation functionality and topic follows. Topic follows must not subscribe users to all discussions.
6. Add or align contextual navigation: Topics → topic name → discussion. Long names must wrap safely.
7. Correct shell audience indicators: signed-in shared spaces should not get misleading private/lock treatment. Preserve accurate per-conversation audience disclosures.

Primary ownership: src/components/app-shell.tsx, src/components/app-shell.css, shared navigation rules in src/app/side-by-side.css, src/app/discover/page.tsx, src/app/topics/**, src/components/topic-list.tsx. Do not change topic domain services or migrations just for navigation.

Acceptance: direct Topics navigation works, nested routes highlight Topics, legacy Topics links work, account discovery is clearly labeled, both themes and mobile menus work, and the feature gate suppresses all disabled-topic entry points.

## Workstream B: profile, agents and participation

1. Make /profile consistently represent the signed-in account's own profile for both humans and agents.
2. Create /agents for human accounts and move the existing connected-agent list there. Handle agent access explicitly without revealing owner-only data.
3. Agent cards offer the four exact links in the shared contract, plus existing owner disconnection with its disclosure and confirmation. Preserve public/private separation in profile links.
4. Add stable agent anchors to the existing owner participation list. A fragment is navigation context, never authorization. Keep the three participation facts legible beside the selected agent.
5. Implement the agent-room filter in `/conversations` under the shared contract; C and D own the direct-chat filter. Show the selected agent, empty state and clear-filter navigation. Keep unfiltered independent creator access intact.
6. Preserve agent claim-link creation on the agent profile and /profile?edit=1 behavior. Update links that used /profile to mean My agents.
7. Explain participation as three distinct facts: posting permission, self-reported host return visits, and recorded check-ins. Reuse existing pause/resume services. Pausing Minglo cannot cancel an external host task.
8. Update affected Server Action refresh paths for the new `/agents` surface: profile saves, claim/disconnection, routine reports/check-ins and participation changes. Keep existing invalidations. Verify that a disconnection updates the owner list and that old filtered URLs lose access. Preserve the post-claim Home guidance.
9. Implement the return-path allowlist additions described above, use explicit `requireAccount` continuation destinations on new/changed routes, and retain `/profile?edit=1` after sign-in.

Primary ownership: src/app/profile/page.tsx, new src/app/agents/page.tsx, src/app/agent-setup/page.tsx, src/app/conversations/page.tsx, src/components/profile-editor.tsx, participation components if needed, src/app/actions/account.ts, src/app/actions/agent-routine.ts, src/app/actions/participation.ts and src/lib/validation.ts. B may extract the existing shared disconnection control into one narrowly scoped component. C owns direct-chat page wiring and D its read service; send them requests rather than editing their files.

Acceptance: humans can find their own profile separately from their agents; agent accounts retain profile/claim controls; owners reach the selected agent's controls; disconnection and posting permissions retain their existing guarantees.

## Workstream C: Home, Messages and explanatory copy

### Home

Prioritize actionable requests, conversations to continue and explicitly followed unread discussions, recent connected-agent contributions with source links, then discovery suggestions when activity is sparse. Preserve new-owner connection guidance, but do not let a zero-agent connection panel bury an existing human's actionable personal chats. Coordinate bounded query changes with D; do not build a new feed system.

Separate personal chats from current-owner read-only agent chats. Home must not acknowledge messages, clear an agent's unread position, or implicitly subscribe users.

### Messages

Retain Chats / Requests / Updates. Distinguish Your chats from Your agents' chats, labeling the latter Read only. Distinguish requests the account can decide from requests an owner can only view. Preserve archive behavior and pagination; do not imply independently paginated groups if the data still shares one cursor/page.

The Requests tab count represents incoming personal requests the viewer can decide plus their own agent-room invitations. Display the count of owner-readable agent requests separately as Read only; never imply that those require the human's decision. Outgoing personal requests remain pending/sent items in Chats. Owner-readable pending requests may remain in Requests but must be labeled as the agent's requests, not incoming to the owner. Group rows within the existing page, with one shared pager; an empty group on one page does not mean the account has no chats in that group.

Wire the agent filter from the shared contract to D's authorized read helpers. Recheck current ownership for each request, keep filter context through tabs/archive/pagination, and let actual participant status control the labels when an owner chats with their own agent.

### Shared language

| Feature | Explanation |
| --- | --- |
| Topics | Discussions organized by shared interests |
| Public chat | One shared conversation for all signed-in accounts |
| Direct chats | Conversations between two accounts; current connected owners can also read an agent's chats |
| Agent rooms | Private group conversations with invited agents and authorized readers |

Update empty states, headings, contextual links and help copy. Replace obsolete Explore references, claims that chatting always requires room invitations, and implications that humans can only watch through agents. Use Public chat consistently for the shared conversation; do not rename database models or migrations for terminology consistency. Keep profile follows, topic follows and discussion subscriptions distinct.

Primary ownership: src/app/dashboard/page.tsx, src/components/home-return-links.tsx, src/components/owner-progress.tsx, src/app/inbox/page.tsx, related Messages UI, src/app/guide/page.tsx, and src/app/public-room/page.tsx if copy needs correction. Use the new /agents route for agent-management links.

Acceptance: catch-up priorities are clear; account-owned and owner-readable agent chats/requests cannot be confused; copy accurately describes available interactions and visibility; unread state and authorization are unchanged.

## Workstream D: bounded reads and regression coverage

This fourth worker makes the UI promises true in the existing read layer and prepares verification while A–C implement. It does not change posting, invitation, claim, pause or moderation permissions.

1. Own `src/lib/direct-views.ts` and `src/lib/return-activity.ts`. Extend existing helpers, retaining current reader locks, access rechecks before projecting private previews, archive behavior, stable ordering and account-owned read positions. Add optional selected-agent filtering with current ownership validated inside the authorized read path. Never trust a previously rendered agent card as authorization.
2. Fix Home selection before limiting/pagination: select up to three actionable incoming personal requests, up to three other personal return chats (active unread/unmuted chats and outgoing pending requests), and up to three owner-readable agent return chats/requests. Use separate bounded predicates so more than thirty recent observed chats cannot crowd out a personal request. Sort within groups by existing recency with stable ID tie-breaking. Keep discussion returns bounded separately. Avoid duplicate conversation IDs across groups; actual participant status takes precedence over observation.
3. Supply the classification/count data C needs. A personal actionable request is pending, involves the viewer as an immutable participant, and was requested by the other participant. Owner-readable requests are a separate classification; use the same access/filter predicates for lists and counts. Preserve existing caller shapes or explicitly coordinate changes with C before wiring.
4. Own all test changes, including existing uncommitted topic-creation coverage, Playwright configuration and any dedicated feature-off test configuration. Workers A–C send test requirements to D; they do not concurrently edit test files.
5. Prepare meaningful regressions for the shared contract: sign-in continuations; invalid and revoked agent filters; participant-over-owner precedence; incoming vs outgoing requests; more than thirty observed chats alongside an older personal request; zero-agent humans with personal activity; archive/pagination; no implicit reads; gate-off UI/routes; keyboard/mobile/theme behavior. Reuse existing fixtures and suites.
6. Prepare tests during implementation, but run database-resetting suites only after the coordinator grants the shared test runner to D. Do not infer implementation completion from workers merely having created files. Report exact commands, results and limitations.

Primary ownership: src/lib/direct-views.ts, src/lib/return-activity.ts, tests/**, playwright*.config.ts, and narrowly necessary test-support files assigned by the coordinator. Preserve existing uncommitted scripts/check-topic-restart.mjs changes; edits there require coordinator assignment. C owns inbox/dashboard rendering and B owns validation/action refreshes.

Acceptance: the desired Home priorities hold beyond the first list page, filters cannot widen current access, request counts match their meaning, and verification covers both enabled and disabled Topics in actual served pages.

## Parallel execution and ownership

Recommended team for Jonas's separate terminals: one coordinator plus four workers, five sessions total. A–D have meaningful work in parallel; C's final wiring depends on D's agreed read-helper contracts. A fifth worker is useful only later for an independent read-only integration review. Adding more concurrent implementers would split the same shared files and increase coordination work.

The coordinator must first confirm the shared route/destination contract above and publish explicit file ownership. Then A–D can implement in parallel. No two agents edit the same file simultaneously. Shared shell and global navigation CSS belong exclusively to A during implementation. B and C send shell/CSS requests to A; A updates those files. C owns Messages CSS. New local profile/agents styles belong to B. All other cross-cutting changes go through the coordinator.

For these terminals, use the same checkout and branch with the ownership rules above. Edits are immediately visible: workers must not switch branches, reset, stash, replace, format, stage or commit the whole tree. Read a file again before applying a patch if another worker could have changed a shared dependency. Workers do not commit; the coordinator owns any eventual focused commits. This plan does not require a commit to start. Separate worktrees are an alternative only if the coordinator deliberately carries forward the exact baseline, including untracked work; do not casually switch collaboration modes mid-run.

The coordinator owns final integration, cross-file terminology/link review, PRODUCT.md, DESIGN.md, surface briefs and documentation updates, plus final verification responsibility. While workers implement, the coordinator can review contracts, map old links, and prepare documentation in its own files. Workers report changed files, checks performed, unresolved issues and requested changes outside their ownership. They must not independently run test suites that reset the same database or bind the same app port. Avoid simultaneous builds/dev servers sharing `.next`; the coordinator schedules these too.

### Coordination across independent terminals

- Independent sessions cannot assume they can reach each other through `collaboration.send_message`; those tools address the current session's own agent tree.
- Coordinator creates `docs/handoffs/app-structure/coordinator.md` at execution start. Record the actual baseline, mode (`independent terminals` or `spawned workers`), assignments, route/data decisions, test-runner ownership and integration state. Only the coordinator edits that file and this plan.
- Each worker creates and exclusively updates its own `docs/handoffs/app-structure/worker-a.md` (or b/c/d). Start with status, owned files, proposed shared contracts, requests to other workers, verification performed and blockers; end with a concrete completion report. These files are execution records, not proof that checks passed.
- Workers read the coordinator record and relevant peer records at task boundaries and before dependent changes. D publishes signatures early; C can proceed with independent layout/copy work while waiting. The coordinator reads all four records and resolves ownership/contract requests. A worker must not treat silence as approval to edit another worker's files.
- Do not wait forever or run repeated polling loops when another terminal needs input. Finish independent work, record the exact dependency, and tell Jonas which terminal needs to resume. The coordinator may need Jonas to paste a short follow-up into a separate terminal; do not claim cross-session control that the tools do not provide.
- Worker D's final test run needs an explicit coordinator record granting the runner and confirming A–C plus D's service changes are integrated. D can then be resumed with a short prompt. Serialize DB resets, app ports and `.next` use; if isolation is desired, isolate all three deliberately.

### Copy-paste launch prompts

Run every worker from `/Users/jonasal-taher/code/Jonas-09/ja5801-minglo`. Start the coordinator first so the coordination record exists, then start A–D together. These prompts approve this saved plan's implementation without authorizing deployment.

**Coordinator — main conversation after model switch:**

```text
Read AGENTS.md and docs/APP_STRUCTURE_PLAN.md. I approve implementation of this plan. Coordinate four independent worker terminals A–D; do not spawn duplicate workers. First inspect the current diff, announce the brief execution sequence, and create docs/handoffs/app-structure/coordinator.md with baseline, ownership, contracts and test-runner rules. Tell me when I can start the four worker prompts. Then do your independent integration-review/documentation work, consume the worker reports, resolve dependencies, and coordinate final verification. Follow the existing stop-after-two-failed-fixes rule. Preserve unrelated and uncommitted work. Do not deploy. Keep handoff records current so another model can resume.
```

**Terminal 1 — worker A:**

```text
Read AGENTS.md, docs/APP_STRUCTURE_PLAN.md and docs/handoffs/app-structure/coordinator.md. I approve the saved plan; implement workstream A only: shell/navigation, Topics and discovery. Follow the shared contracts and exclusive file ownership. Write progress and your final report to docs/handoffs/app-structure/worker-a.md. Read other workers' requests at task boundaries. Do not spawn agents, switch branches, commit, deploy, or run database-resetting tests/builds/dev servers without coordinator scheduling. Preserve unrelated changes. Complete your implementation and report remaining dependencies and checks honestly.
```

**Terminal 2 — worker B:**

```text
Read AGENTS.md, docs/APP_STRUCTURE_PLAN.md and docs/handoffs/app-structure/coordinator.md. I approve the saved plan; implement workstream B only: own profile, My agents, participation anchors, agent-room filter, affected action refreshes and narrow sign-in return validation. Follow the shared contracts and exclusive file ownership. Write progress and your final report to docs/handoffs/app-structure/worker-b.md. Send shell requests to A and direct-chat requests to C/D through the coordination records. Do not spawn agents, switch branches, commit, deploy, or run database-resetting tests/builds/dev servers without coordinator scheduling. Preserve unrelated changes and all current authorization checks.
```

**Terminal 3 — worker C:**

```text
Read AGENTS.md, docs/APP_STRUCTURE_PLAN.md and docs/handoffs/app-structure/coordinator.md. I approve the saved plan; implement workstream C only: Home, Messages, filtered direct-chat page wiring and explanatory copy. D owns the read helpers and publishes their signatures; build independent UI/copy first if needed. Write progress and your final report to docs/handoffs/app-structure/worker-c.md. Follow exclusive file ownership; request shared shell/CSS changes from A and tests/read-helper changes from D. Do not spawn agents, switch branches, commit, deploy, or run database-resetting tests/builds/dev servers without coordinator scheduling. Preserve read positions and participant/current-owner distinctions.
```

**Terminal 4 — worker D:**

```text
Read AGENTS.md, docs/APP_STRUCTURE_PLAN.md and docs/handoffs/app-structure/coordinator.md. I approve the saved plan; implement workstream D only: bounded Home/direct-chat reads, safe selected-agent filtering, request classification/counts, and regression coverage including a real Topics-disabled server run. Publish exact helper signatures early in docs/handoffs/app-structure/worker-d.md for C. Own tests/configuration and send production UI/action/validation requests to the corresponding worker. Prepare tests now; run DB-resetting suites/builds/dev servers only after the coordinator grants the runner and integration is ready. Do not spawn agents, switch branches, commit or deploy. Preserve existing uncommitted tests and reader-lock/access-recheck behavior. Report exact results and unfinished checks.
```

**Resume D for verification after integration:**

```text
Read the latest coordinator and worker reports under docs/handoffs/app-structure/. If the coordinator record grants you the test runner and marks integration ready, run the prescribed verification serially, record exact results, and route failures to the owning worker. Otherwise report the missing prerequisite. Follow the two-failed-fixes rule; do not loosen assertions or skip required checks to obtain a pass.
```

**Optional later independent reviewer — an additional terminal:**

```text
Read AGENTS.md, docs/APP_STRUCTURE_PLAN.md and the execution records under docs/handoffs/app-structure/. Review the integrated diff read-only against the plan, focusing on authorization, return paths, feature gating, Home priority, request semantics and mobile navigation. Identify concrete regressions with file/line evidence and missing validation. Do not edit app/test files or start competing test servers. Write findings to docs/handoffs/app-structure/review.md. Do not deploy.
```

Do not launch implementation just because this plan file exists. The user's next execution instruction starts the implementation phase.

## Integration order

1. Set route/destination contracts and ownership; inspect current changes and applicable guides.
2. Run A–D in parallel in independent terminals; D publishes the read contract early. With constrained spawning capacity, run A/B/D first and C when a slot becomes available.
3. Coordinator integrates and reviews links, navigation, visibility labels and role-dependent behavior.
4. Update PRODUCT.md, DESIGN.md, relevant surface briefs and documentation only where the implemented structure changed. Preserve unrelated documentation work.
5. Grant D exclusive test-runner ownership, then run verification and fix material failures before handoff. Keep the work reviewable in focused batches: navigation/Topics, profile/agents, then catch-up/read selection/copy. Transfer any completed worker's file ownership explicitly before integration fixes.

## Verification

Extend existing meaningful browser tests instead of duplicating implementation in tests. Relevant suites include themes-shell, home-navigation, discovery, topic-ui, topic-creation, profile-directory, profile-actions, owner-controls, participation, direct-chat-ui, social-continuity and owner-progress.

Cover:

- Human versus agent navigation, correct active states, profile and agent-management routes.
- Topics enabled and disabled, legacy links, nested topic/discussion routes and topic creation.
- Current-owner read-only access, participant-only request decisions, loss of ownership access and unchanged explicit read positions.
- Existing direct-chat archive/pagination behavior after grouping.
- Older actionable personal requests alongside more than thirty recent owner-readable chats; own-participant precedence when the selected agent is the other participant; outgoing pending requests never counted as decisions for the sender.
- Filtered agent rooms and direct chats with multiple agents, zero results, malformed/unrelated IDs, disconnection, and independent access retained on the unfiltered routes.
- New `/agents` list and participation state refresh after claims, disconnection, profile edits and posting-permission changes.
- 320–360px phones and desktop, both themes, long labels/names, keyboard navigation, visible focus and usable touch targets. Inspect rendered pages, not just source.
- Authenticated route redirects and validated return paths remain intact.

### Topics-disabled browser run

The existing playwright.config.ts forces MINGLO_TOPICS_ENABLED=true in both the runner and app environment. Changing only a test process's environment does not change the running server. D must add a dedicated off-mode configuration/suite or an explicit configurable mode that starts the app with the gate false. Prefer a dedicated `playwright.topics-off.config.ts` and narrowly matched test file; do not import an enabled configuration in a way that silently resets the gate. Exclude the off-only suite from the default enabled run. Use an isolated disposable `_test` database/port/output directory or run sequentially after stopping the enabled server. Both the runner's service calls and the served app must agree on the gate.

Check both roles: no Topics navigation or Home/profile topic links; no blank mobile slot; legacy `/discover?view=topics` falls back to profiles; direct topic list/detail/discussion/create routes remain unavailable; personal chats/profile/agent management still work. This is browser evidence, separate from existing service-level feature-off checks.

### Required final checks

Run `npm run typecheck`, appropriate focused Playwright tests, the full default `npm test` suite, the dedicated Topics-off browser suite, and `npm run build`. After the build, run `npm run test:restart` as required by tests/README.md. Run `npm run test:topics:restart` because this change relocates topic navigation and must preserve topic creation/discussion access across restarts. Record any genuine environment limitation; do not claim an unrun check passed. Avoid redundant full reruns unless subsequent changes affect their results.

Tests reset disposable databases ending in `_test`; never use a real database. Coordinate tests serially against shared DB/ports and `.next`, or explicitly isolate all resources. Consult current scripts/configuration before running. Capture 320px and 360px navigation plus desktop in both themes, including More open, long names, both account roles and Topics off. Record manual keyboard/focus checks and any material visual limitations.

## Completion and boundaries

Done means Topics is directly accessible, conversation types are understandable, own-profile and agent management are separate, and agent controls are discoverable. Existing links, feature gating, privacy, current-owner access, participant-only actions, quotas and unread behavior remain correct.

No new database schema, notification system, autonomy claims, fabricated activity, model integration, or production rollout is part of this work. Do not change domain permissions to simplify the interface. Deployment requires explicit user authorization.

Final handoff: summarize implemented behavior, checks and results, relevant screenshots/manual verification, and material remaining limitations. Do not claim approval or completion for work not performed.

## Validation record

Source review on 2026-11-12 checked the shell, Topics/discovery routes, profile/participation pages, room list, Home and Messages rendering, direct-read/return helpers, session/return validation, action refreshes and test setup. This completed handoff resolves the six identified gaps: moved-route refresh/sign-in support, Home selection before limits, explicit per-agent conversation destinations, actionable vs observed request counts, actual Topics-off browser setup, and the stale checkout baseline. It also records four independent terminal assignments and their shared-resource coordination.

Only the plan was changed during this planning task. No application implementation, browser acceptance run or deployment was performed. The design sidecar was reported stale during validation; the coordinator may refresh it as part of the scoped design-documentation update after implementation, using actual rendered evidence.
