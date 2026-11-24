# Minglo Projects UX release plan

**Handoff for implementation · November 24, 2026.** Baseline is `main` at `1fd96f7`, the release record for Projects v2 shipped at `f2be86f` (Heroku v60). The deliverable for the implementing agent is a tested local release candidate.

## What should feel different

A person can start a private project, invite a teammate and give them real work on their first visit. On the next visit, each participant can immediately tell what they can do, what depends on someone else and where to find the finished result. The same journey works on a phone and for an agent operating a browser in a fresh session.

Keep Minglo’s cobalt frame, light and dark reading surfaces, Public Sans headings and attributed voices. Use `DESIGN.md` and the shipped CSS for visual decisions. The generated design-token sidecar predates the current design document. Spend the design effort on the screens people use to **start, do, review and finish** the work. Outside Projects, improve the paths in from Home and Messages → Updates. Keep More → Projects available from anywhere.

## What prompted this plan

I signed into the existing disposable workshop preview as the lead and as the agent assigned a question. I opened Home, Updates, the project list, creation, overview, plan, task, team, outputs, decisions, delivery history, the approved package and the agent’s question. Measurements below are CSS pixels in Chrome at normal zoom, light mode, with Topics enabled. The phone was 390 × 844 and the desktop was 1440 × 900. The pending approval, revision and invite states were also inspected in source and the existing test. These are interface observations. Independent participant success is still to be measured.

| Where | Current experience | Release target |
| --- | --- | --- |
| Create | The blank form has five visible fields. Selecting the workshop starter expands it to 17. On the phone the Create button moves from y=1165 to y=2994. | Preview all three tasks by name. Editing them is optional. Choosing the starter adds at most 300px to the position of Create in the same fixture. |
| Plan | Project name, section navigation, filters and lead controls precede the work. The first task link starts at y=918 on the phone and y=721 on desktop. Move down is a prominent filled button on a completed task. | Show the first full task row in the initial viewport at both sizes. Keep reordering available to the lead in an explicit edit mode. |
| Return | The lead’s Overview says **Your next action → Waiting for an answer → Follow-up resources**. The exercises agent has the actual question. Home drops the project and status from its queue rows. | The lead sees who owes the answer. The agent gets **Answer “Which resources are suitable for beginners?”**. Both links open the same question with the correct controls. |
| Finish | Outputs lists documents, Decisions opens a panel headed **Discussion**, and Delivery puts preparation ahead of the existing package. On the lead’s phone, **Delivery history** begins at y=1226 even after approval. | A member can open the latest approved package directly from Overview. Results distinguishes working documents, a package awaiting a decision and an approved package, including when all three coexist. |

Two source findings affect trust. Overview currently searches the first 20 items in each account-wide queue for an item in the open project. A busy member can therefore lose the action on that very project. The package screen also renders the saved brief beside the **live** project success criteria, although the manifest saves both. Include a regression for each. The four-account workshop test already verifies meaningful transitions, but uses direct task and version URLs for several participant steps. Add a journey that has to find the links.

## The journey to implement

| Moment | What the participant sees and does |
| --- | --- |
| **1. Start** | Home → **Start a project**. The person names the result, describes it and says how the team will know it is done. **Start blank** and **Workshop kit** sit together. The workshop choice previews the agenda, exercises and handout, including the handout’s dependency. **Edit starter tasks** and an optional due date expand in place. **Create private project** saves once. |
| **2. Organize and invite** | A new blank overview offers **Add first task**, with **Invite teammates** beside it. A starter project already has three tasks and offers **Assign tasks**. Solo work can start immediately. Team shows invited and joined accounts separately, with person/agent identity and reader/contributor access. Assigning a pending invitee says **Waiting for @handle to join**. The invitation shows the project name, inviter, access and what joining means. The brief opens after acceptance. |
| **3. Work** | From Home an agent follows **Start the facilitator agenda**. The task opens on its brief, done condition and inputs. After starting, **Save private draft** keeps work available across sessions. **Submit version 1 for review** shares the saved version with the team and names the reviewer when assigned. Button wording follows the task’s actual readiness rule. |
| **4. Review and revise** | The reviewer opens **Review facilitator agenda v1** and requests “Cut 20 minutes.” On return the drafter sees that note, the author and v1 next to the editor. The reviewer opens v2, sees the change and can recommend that exact version. A teammate blocked on the exercise sheet sees the missing input and can open its pinned version once ready. A named question goes straight to its responder. |
| **5. Decide** | The lead prepares the workshop package from completed versions. The designated human opens **Review workshop kit for approval** from Updates. One reading surface brings together the submitted brief, saved success criteria, three named versions and reviewer notes. The human can approve that package or return it with a reason. An assigned task approval has its own version and distinct wording. |
| **6. Use the result** | The next day a current member follows **Open approved workshop kit**. They see the named approver, date, agenda v2, exercises v1 and handout v1. Download Markdown, copy and print are available together. An optional follow-up task can remain open alongside the approved result. An older package link always opens that package. |

## Navigation and layout decisions

Use four project destinations with ordinary links. Preserve existing URLs, sign-in continuations, browser Back and exact-version bookmarks.

| Visible destination | Existing routes and contents |
| --- | --- |
| **Overview** | Project root. First show the viewer’s decision or actionable work, then waiting work, the approved result when one exists, and team activity. Link **Questions & decisions** to `/decisions`, including the named responder and exact `/questions/[id]` links. Keep project-level comments and proposals reachable. |
| **Tasks** | `/plan` and `/tasks/[id]`, including versions. Group by milestone with a compact owner, current state and next person per row. Keep filters, assignments, dependencies, proposals and reordering. For an ungrouped-only plan, use **Tasks** as the section title. |
| **Results** | `/outputs` is the landing page. Give **Documents** and **Packages** clear links within it. `/delivery` opens Packages, and `/delivery/[releaseId]` opens the exact package. Preserve shared notes, reference links and their existing anchors in Documents. |
| **Team** | `/team` for invitations, members and participation controls. Give a lead a direct invite action, show the roster first on subsequent visits, and keep removal, leave and closure clearly labeled away from routine work. |

On desktop use a compact project header followed by the section links. Show tasks as rows on a single reading surface. A detail page gives the document the wider column and the decision a narrower column when there is room. On a phone use one compact section selector labeled with the current section, a visible parent link and one content column. Place a **Review these versions** jump before a long document and the decision controls beside the evidence in reading order. Use the first viewport for the task, question or package that brought someone here. Give ordinary links and filled buttons distinct jobs. A move, filter or background event should never compete visually with the participant’s decision.

## Work in six reviewable batches

### 1. Make personal work truthful

Begin with the blocked workshop follow-up and a member with over 20 newer tasks in other projects. Write failing cases for the incorrect next action and missing project-specific action. In `src/lib/projects/queries.ts` derive actionable, waiting and informational rows from the viewer’s membership, assignment, readiness, pause, inputs and question state. Apply the authorized project filter **before** the limit for Overview. Include the actual verb, project, exact target and version or waiting party. Share the meaning across `workspace/workspace.tsx`, `src/components/project-returns.tsx` and the directory. Use bounded reads and keep independent queue cursors. Where the directory mixes formats, use v2 release/task data for v2 labels and the existing phase for v1.

**Accept when** the busy member still finds their action in the project. An open blocked task can still offer any currently permitted private draft work, but answering belongs to the named responder. A paused agent has no actionable posting prompt. An invitation remains discoverable under queue pressure. Previews never mark activity seen. Test a reader, a removed member and a connected owner with no membership.

### 2. Rebuild the project frame and task list

Implement the four destinations, responsive header and task rows in `src/app/projects/workspace/{workspace,plan}.tsx`, `src/app/projects/projects.css` and the directory at `src/app/projects/page.tsx`. Use the design tokens in `src/app/side-by-side.css`. Keep the first useful task visible, with add/edit/reorder controls secondary. Give each nested route its correct parent, heading and active section. Keep legacy project and conversion routing intact in `src/app/projects/[id]/[[...work]]/page.tsx`.

**Accept when** the measured first task row fits on desktop and phone, a keyboard user can filter and reorder, and a reader can reach all four sections. At 320px, long names, task titles and section controls wrap without page overflow or concealed destinations. Existing Plan, Decisions, Outputs and Delivery links still open their intended content after sign-in.

### 3. Shorten kickoff and connect it to staffing

Update `new/page.tsx`, `workspace/kickoff.tsx`, `workspace/plan.tsx` and `invitations/[id]/page.tsx` under `src/app/projects/`. Disclose starter editors per task. Preserve edits when collapsing or switching starters within the form, including after validation fails. Keep the three defaults and any overrides in the creation payload expected by `src/app/actions/workspace.ts`. After create, show the next step appropriate to the actual plan. Put **Assign to me** or an equivalent clearly labeled selection on the existing assignment form for solo leads. Explain pending membership at assignment time.

**Accept when** a first-timer can create a blank project, add and take their own task, or use the starter and invite a collaborator. Both paths work from Home with Topics disabled. An invitee can accept or decline from their own account. Retrying creation or invitation produces one intended result. A pending invitee cannot read a brief preview. Check the 300px starter expansion target with its optional editors collapsed.

### 4. Design task pages around the person arriving

In `workspace/{work,editor,fields,document}.tsx`, give each role a clear starting point. Writers see the brief or the requested revision, their saved draft and the recipient of their next submission. Reviewers see the specified version, what changed and the previous version comparison. Named responders see the question, requester, blocked task and answer control together. Readers see the same shared evidence with read-only attribution. Separate **Required for completion** from **Submitted**, **Recommended by …** and **Approved by …**. Use a factual saved/pending/error message and preserve unsent text through conflicts. Keep advanced inputs, discussion and management in reach.

**Accept when** fresh sessions find v1 → requested change → v2 → recommendation through visible links. A stale tab can compare with saved work and recover its text. It cannot recommend or approve an obsolete version. A second submit does not create v3. An agent waiting for an upstream version sees why, while an independent teammate can continue. Include the paused, replaced assignee and blocking-question cases.

### 5. Put the decision and finished result together

In `workspace/delivery.tsx`, show current approved delivery, pending decision and earlier packages with their own identities. In the lead’s preparation form, explain each blocker and link to the required work. On a submitted package, use both `manifest.brief` and `manifest.doneWhen`. Group exact versions, author and recorded signoffs. Keep the document contents readable in full. Give copy failure a visible recovery path to Markdown download in `workspace/editor.tsx`. Reuse the authorized export route and `src/lib/projects/export.ts`.

**Accept when** the designated human can reach the package in one link from their personal queue, read or return it, and approve an eligible submission. Any current member can open the approved result in one link from Overview. Later edits to the brief, reopened tasks and a second package leave the first receipt and exported bodies accurate. Print includes every selected document and excludes controls. Revocation removes access to the page and download.

### 6. Finish Home, Updates and release verification

Use the same concise action rows on `src/app/dashboard/page.tsx`, `src/app/inbox/page.tsx` and `src/components/project-returns.tsx`. For someone with work, show the action and project name together. For a person with no projects, keep one quiet entry to create one. Preserve incoming chat requests, conversation returns, account-scoped Updates and the existing Topics-on/off navigation. On the directory, separate invitations, personal decisions, work and ordinary project membership. An empty queue should give space back to the list. Keep a path to all items when the Home preview is full.

**Accept when** the lead, drafting agent, reviewer and human approver can finish the workshop from Home or Updates through visible links. Each role gets the appropriate action after a fresh sign-in. A person using Minglo only for conversations can still find their incoming messages and discussions. Deliver the local preview and evidence below.

## Verification and handoff

**Software and visual checks.** Read `AGENTS.md`, `DESIGN.md`, `docs/PROJECTS.md` and the installed Next.js guides before implementation. Extend `tests/e2e/project-workspace.spec.ts` with a normal-entry journey using separate browser contexts. Fixtures may prepare state. Once a participant starts, navigate using visible links rather than fixture IDs or direct test navigation. Keep the direct-route tests for exact identity, denials and stale links. Cover solo, one-agent and four-account projects, simultaneous submissions, private draft recovery, v1 conversion, closed projects and the v2 read-only flag. Check every new preview with a positive-control member and a nonmember.

Capture the same phone and desktop states before and after. Also check 320px, a tablet width, both themes, 200% zoom, visible keyboard focus, 44px controls, reading order, field errors, focus return and status announcements. Try a long title, a long version diff and a package with three documents. Exercise the full decision flow by keyboard and spot-check the task/question controls with a screen reader. Record what was actually observed.

On disposable loopback `_test` databases, run the focused Projects suites, full `npm test`, production build, typecheck, `npm run test:restart -- --projects --workspace` and `npm run test:topics:restart`. Follow the repo’s order so the restart checks have their full-suite fixtures. Serialize runners sharing `.next` or port 3100. Include the separate Topics-off suite, affected auth/analytics suites and the dependency audit. Record the revision, commands, results, viewport comparisons and known gaps in the local handoff.

**Does it feel easier?** Give two people unfamiliar with the design the disposable preview, one on a phone. Ask them to organize a workshop, find why the handout is waiting, identify whose turn it is, then find and export the accepted kit. Supply goals and accounts only. Record first clicks, wrong turns, requests for help and the version they think was approved. Target both participants completing all four goals without coaching and identifying the correct approved versions. Fix the first repeated obstacle and retest. For the separate host trial, follow `docs/PROJECTS.md` with two independently hosted agents and a human. Record host prompts, links or messages relayed by a person, successful fresh-session returns and the quality of the output. Keep any unavailable participant or host trial explicitly pending.

**Working scope.** Use the existing membership, revision, retry and authorization services. Project participation continues to require individual acceptance. Claims, private transcripts, host schedules and external publishing are outside this UI release. The planned changes fit the existing schema and stack. The implementation handoff ends with the tested local candidate, a working preview and a short account of what still needs human evidence.

### Instruction for the next agent

> Implement `docs/MINGLO_PROJECTS_UX_PLAN.md` through all six batches. Start with the blocked-task and project-scoped queue regressions. Demonstrate the complete workshop through visible links on phone and desktop. Stop with the tested local release candidate before deployment.
