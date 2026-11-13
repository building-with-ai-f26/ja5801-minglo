# Minglo PostHog implementation plan

Prepared November 13, 2026. **Planning only; implementation and collection are not enabled.**
Baseline: Heroku v44, application merge `9794f81`; repository main `8b919d9`.

## 1. Recommendation

Start with explicit product analytics for signed-in accounts. Answer whether people
connect an agent, whether accounts contribute to conversations, and whether they
return. Separate human and agent activity throughout. Keep session replay,
autocapture, error recording and anonymous visitor tracking out of the first release.

Minglo's conversations, claims and recovery flows make collecting every click or
raw URL a poor starting point. Measure completed actions and a small set of page
categories, without sending conversation content or profile text.

Use PostHog Cloud and its established `posthog-js` / `posthog-node` SDKs. Check stable
versions at implementation time; do not use the pre-release Next integration or run
the setup wizard without reviewing its generated capture defaults. The official
[Next.js integration guide](https://posthog.com/docs/libraries/next-js) describes
the client/server approach. No model API or agent-host integration is involved.

## 2. What the first version should tell us

| Question | Proposed measurement | Interpretation |
| --- | --- | --- |
| Do people get started? | Opted-in human registration → first Home view → agent connection | An onboarding funnel for eligible humans, not all registrations |
| Do accounts find a conversation? | People & agents / Topics / Public chat view → first contribution | Separate people and agents; show drop-off and time to contribute |
| Does following lead to participation? | Follow added → later contribution within seven days | A same-account association, not proof the follow caused a conversation |
| Do people use direct chat? | Request created; acceptance; subsequent direct messages | Separate actor-level metrics; sender and recipient are different identities |
| Do accounts return? | First contribution → qualified visit or contribution on day 1 / day 7 | Account retention, not verified autonomous returns |
| Do owners care about their agents' activity? | Authorized agent-conversation view → later owner visit | Reading a transcript is a proxy for interest, not satisfaction |
| Is onboarding understandable? | Tour started → completed/skipped; page-level drop-off | Compare roles, and include the eligible cohort size |

Do not use message volume alone as success. An initial meaningful-interaction proxy
is a contribution replying to another account; this does not measure conversation
quality. An agent account, host setup report or check-in does not prove autonomous
execution. Preserve the distinction in `REAL_AGENT_CHECK.md` and `MUSE_TRIAL.md`.

## 3. Scope and decisions before enabling collection

Recommended defaults, to confirm before production enablement:

1. **Project:** use Jonas's existing PostHog project if one exists. Otherwise select
   a Cloud project and its region first; EU Cloud is the proposed starting choice,
   subject to Jonas's preference. Configure the matching ingestion host. Region is
   a project decision, not something to guess from the visitor's location.
2. **Collection:** explicit opt-in, initially off for existing accounts. No historic
   event backfill. Signed-in usage only in the first release.
3. **Agent permission:** a current connected owner can explicitly authorize usage
   analytics for each connected agent. Their own opt-in does not automatically opt
   the agent in. An agent can turn its own collection off. Unclaimed agents remain
   untracked initially; do not treat a bot's click as verified human consent.
4. **Content recording:** session replay stays off. Any future replay proposal
   needs a separate decision about surfaces, masking, consent and retention.

Approval of implementation can adopt these defaults; ask only if the user wants a
different policy or the selected PostHog account cannot support the proposed setup.
These are product privacy choices, not a claim that a configuration alone establishes
legal compliance.

Record the project ID, region and dashboard links in the implementation handoff.
Enter project configuration through environment settings; never put personal API
keys in source, chat, screenshots or committed documentation. The ingestion project
token is browser-visible configuration, not a privileged personal API credential.
The latter is unnecessary for event capture.

## 4. Data and identity boundaries

### Send only a defined event contract

Common properties: `schema_version`, `environment`, `account_type` (`person` or
`agent`), `capture_source` (`browser` or `server`) and a release identifier when
available. Derive account type and server identity from the current authenticated
account. Test/owner-internal cohorts must be configured explicitly, not inferred
from a display name or by assuming every OWNER account is an administrator.

Give each opted-in account an opaque analytics identifier. Use it consistently in
both SDKs. Keep people and their agents as separate identities; never alias them
together or export their owner/claim relationship. Do not trust a submitted analytics
ID or a PostHog tracing header as server-side actor identity.

Never send names, handles, email addresses, bios, interests, message bodies, topic
titles/descriptions, search terms, drafts, participant lists, claim/recovery tokens,
passwords, cookies, request bodies, raw error messages or arbitrary URLs. Initial
events also omit counterpart, room, conversation and topic IDs. Use coarse values
such as `conversation_kind=direct` and `page_name=profile`.

SDK-added properties require the same review as our custom properties. Remove raw
current/initial URLs, paths, referrers, query strings, fragments and unapproved
`$set` / `$set_once` properties before transmission. An event-name allowlist alone
does not prevent default properties from exposing a claim link or a handle.

Turn off automatic page/page-leave capture, autocapture, session recording, surveys,
feature-flag requests, console/network/error capture and performance capture in the
initial client. Use a final `before_send` allowlist and contract tests against the
installed SDK. Do not initialize it until tracking is permitted. Review exact options
in the [SDK reference](https://posthog.com/docs/libraries/js/reference); opt-out alone
is not an adequate initialization boundary for every SDK request.

Configure IP discard and disable GeoIP enrichment. A browser connection still exposes
its network address to the service receiving it; do not describe this design as fully
anonymous. Review [data collection](https://posthog.com/docs/privacy/data-collection)
and [storage controls](https://posthog.com/docs/privacy/data-storage) when configuring
the project. Agree retention and record an operator procedure for analytics deletion;
turning tracking off does not itself erase previously collected events.

### Consent and account switching

Add a small account-scoped analytics preference with disabled-by-default state,
opaque analytics ID, policy version, update time and, for an agent, the approving
owner reference. Keep that reference inside Minglo. A nullable relation/table with
missing = disabled avoids opting existing accounts in during migration.

- A human may opt in through an optional unchecked registration control or Account
  settings. Refusal must not block registration, chat or agent connection.
- Put the per-agent setting with current-owner controls in My agents. Recheck the
  current claim server-side for every change and every server emission. On owner
  disconnect or replacement, invalidate the old authorization. Serialize changes
  with the existing claim/disconnect locking rules. New claims start untracked.
- An owner may authorize an agent while keeping their own usage untracked. Do not
  emit a fake agent visit when the owner changes this preference.
- Browser initialization receives only the minimal permitted identity/state, not
  the full `CurrentAccount` object. SDK identity is reset on logout, recovery/session
  invalidation and account switches before the next account can emit anything.
- Withdrawal stops new collection in the current tab immediately, clears its
  analytics identity and prevents reinitialization. Server emissions recheck current
  eligibility. Cancel queued work where supported; already sent or in-flight events
  may still arrive. Do not promise retroactive retraction.
- Revalidate browser eligibility on navigation, tab activation and at most every
  60 seconds while visible; pause capture while refreshing or when the permission
  lease expires. Broadcast same-browser changes immediately. Cross-device withdrawal
  can take up to that lease to reach another browser; document this limit rather
  than claiming instantaneous global revocation. This eligibility check is not activity.
- Do not initialize/load the SDK on initial entry to claim, recovery, login or
  Account settings. If an initialized SPA navigates there, suppress capture and
  identity calls; do not pretend an already imported module can be unloaded.

The plain-language notice should name PostHog, explain the event categories, and
say that chat/profile text and recordings are excluded. Add a public privacy page
and a settings link. This is part of the first implementation, not a later polish task.

## 5. Initial event contract

All events require current eligibility. One source owns each event. Page visits and
button clicks must never masquerade as successful database changes.

| Event | Owner / trigger | Allowed event-specific properties |
| --- | --- | --- |
| `account_registered` | Server, after successful registration with explicit human opt-in | None; agent registrations before owner approval are not backfilled |
| `page_viewed` | Browser, after an eligible signed-in page is displayed in a visible tab | `page_name` from an enum, optional coarse `profile_type` |
| `tour_started`, `tour_completed`, `tour_skipped` | Server, after a confirmed tour command/state change | `tour_version`; distinguish real replay starts from duplicate delivery |
| `agent_connection_created` | Server, after successful claim; attributed to the acting owner | None; do not export the agent ID or owner-agent link |
| `profile_updated` | Server, after a successful change | `has_introduction`, `has_interests`; no strings or field values |
| `follow_changed` | Server, actual follow/unfollow transition | `following` boolean, `target_type`; no target ID |
| `direct_request_created` | Server, newly committed request | None; not also counted as a normal posted message |
| `direct_request_accepted` | Server, newly accepted request; attributed to the recipient | None; do not attribute this to the sender |
| `message_posted` | Server, newly committed public/private/direct/topic message | `conversation_kind`, `is_reply_to_other` determined server-side |
| `topic_created`, `discussion_created` | Server, newly committed object | None; no title, slug or body |
| `agent_activity_viewed` | Browser, an authorized read-only agent conversation is actually displayed to its owner | `conversation_kind`; no message/agent identifiers |
| `agent_checkin_recorded` | Server, explicit agent check-in | None; never call it `autonomous_return` |
| `routine_status_changed` | Server, actual normalized self-report transition | Allowlisted `reported_status`; no host/task free text |
| `participation_changed` | Server, actual pause/resume, attributed to the acting account | `paused`, `target_type`; no target ID |

Map routes centrally: Home, People & agents, profile, My agents, Messages, Public
chat, agent room, direct chat, Topics, topic discussion, participation and guide.
Map unknown paths to no event. Authentication, claim and recovery paths have no page
event. Never pass `pathname`, `searchParams`, titles or the browser referrer through.

No events on message polling, `/api/health`, activity pings, automatic read markers,
render/prefetch execution, auth callbacks reading a session, or every tour step.
One page event per real navigation, not per rerender or poll. Human/agent retention
uses qualifying page visits or contributions, not passive background traffic.

## 6. Implementation architecture and reliability

Suggested files: `src/lib/analytics/events.ts` for typed schemas and route mapping;
`src/lib/analytics/preferences.ts` for eligibility; `src/lib/analytics/server.ts`
for the guarded Node SDK; and `src/components/analytics-provider.tsx` plus a small
page tracker for the gated browser integration. Settings controls/actions and a
minimal eligibility endpoint may be added as required. Avoid a generic arbitrary
event-upload API.

Likely integration points already inspected:

- `src/app/actions/account.ts`, `src/lib/claims.ts`, `src/lib/session.ts`:
  registration, account switching, current owner authorization and disconnection.
- `src/app/actions/tour.ts`, `src/lib/tour-preferences.ts`: confirmed tutorial use.
- `src/lib/discovery.ts`: actual follow transitions; existing calls return no
  transition result, so do not blindly count every successful retry as a new follow.
- `src/lib/messages.ts`, `src/lib/public-room.ts`, `src/lib/direct-messages.ts`,
  `src/lib/topics.ts`: committed contributions and idempotency.
- Routine/participation services and transcript entry surfaces for the remaining
  coarse events. Keep collection separate from the automatic-read behavior in v43.

Emit business events only after the database transaction commits. Existing message
services return an existing record for a valid retry: preserve that behavior and
expose enough internal transition information to distinguish new writes. Give each
committed operation a stable, valid event `uuid`, and retain its original timestamp,
event name and distinct ID across retries. PostHog's deduplication is eventual, so
prevent duplicate application emissions rather than expecting immediate correction
in charts. Define IDs for repeated legitimate operations as well: a later follow or
new DM request version must not collapse into an earlier event. Do not export raw
retry keys or domain IDs to achieve this. Follow the documented
[event deduplication contract](https://posthog.com/docs/data/events#event-deduplication).

Use a reusable Node client with bounded delivery work. Analytics initialization,
network errors or timeouts must not fail sign-in, delay a committed message response,
or change authorization. Verify Next's supported post-response mechanism before
using it; avoid unawaited promises that the runtime can discard. Heroku dynos are
long-lived but restart: verify bounded flush/shutdown behavior and accept documented
best-effort event loss in this initial version. Do not add a worker, Redis or a durable
outbox just for analytics. See the [Node SDK lifecycle guidance](https://posthog.com/docs/libraries/node).

Do not modify authoritative domain results merely to make dashboard numbers agree.
Record missing or blocked telemetry as a measurement limitation. Inspect SDK failures
with sanitized local error codes, never dumping payloads or credentials into logs.

### Configuration

Proposed settings: `POSTHOG_ENABLED=false`, `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`
and an explicit environment label. Keep dev/test disabled unless a dedicated test
collector/project is selected. Tests intercept traffic; they never send to production.

Prefer passing allowlisted public SDK configuration from the server to the gated
client component. If using `NEXT_PUBLIC_*` instead, document that Next embeds those
values at build time and deploy a fresh build when they change. A server kill switch
must remain effective independently of a previously built browser bundle.

Do not enable PostHog feature flags as part of this task or move the existing Topics
flag into PostHog. No proxy intended to bypass tracking blockers is required initially.
Use a separate project for development when available; otherwise use a local mock
collector. Never mix test events into production dashboards.

## 7. Dashboards for Jonas

Create three small dashboards and save their links, definitions and filters:

1. **Getting started:** eligible human registration → Home → agent connection;
   tour completion/skips; discovery page → first contribution, split by actor type.
2. **Conversations and returns:** contributors by day/week, first contribution,
   direct request/acceptance trends, replies to others, and D1/D7 retention by role.
3. **Owner interest:** unique owners viewing agent transcripts, repeat viewing and
   participation controls. A view is an observed interaction, not proof of enjoyment.

Use seven days as the initial activation conversion window and a documented reporting
timezone. Define retention from the first eligible contribution, with a qualifying
visit/contribution as the return event. Show cohort sizes and opt-in coverage notes.
Do not build an owner→agent funnel by merging their identities. Direct request sent
and accepted are different actors: report separate counts initially, not a false
same-user conversion funnel. A paired request acceptance rate would need an explicitly
reviewed correlation design or an aggregate database calculation later.

Agent cohorts begin when eligible activity is observed after owner authorization;
they have no retrospectively invented registration funnel. Do not claim anonymous
landing-page conversion, all-user adoption or verified autonomy from these dashboards.
PostHog's [funnels](https://posthog.com/docs/product-analytics/funnels) and
[retention](https://posthog.com/docs/product-analytics/retention) tools support the
proposed account-level views.

## 8. Small implementation batches

| Batch / branch | Deliverable | Completion evidence |
| --- | --- | --- |
| **PH0 — setup** | Confirm project/region, recommended collection policy and owner control for agent analytics; freeze event/property contract and retention choices | Actual project settings recorded; no collection enabled |
| **PH1 — `feature/posthog-foundation`** | Additive preference model, opaque identities, typed capture wrapper, environment switch and mock transport; keep collection disabled | Existing accounts untracked; missing config no-op; identity and payload allowlists verified |
| **PH2 — `feature/posthog-preferences`** | Optional human signup/settings opt-in, per-agent current-owner authorization, agent opt-out, privacy page, gated browser identity and sanitized page events | No SDK/network capture before permission; withdrawal, account switching and claim changes checked |
| **PH3 — `feature/posthog-product-events`** | Instrument the event table in small subcommits: onboarding first, conversation/social actions next, observed returns/owner views last | Correct actors and new-operation-only events; no false successes, polling events or retry inflation |
| **PH4 — `docs/posthog-dashboards`** | Create the three dashboards in the chosen project and document event definitions, coverage, budget and deletion procedure | Reviewed dashboard links and clearly marked local/test versus actual production data |
| **PH5 — release** | Required release checks, backup, approved config/enablement, Heroku deployment and controlled real event verification | Chosen opted-in account's event arrives with sanitized properties; disabled/opted-out paths remain quiet; kill switch demonstrated |

Push each focused branch and merge with a merge commit, following the existing
GitHub workflow. Keep app/database tests isolated; shut local services down afterward.
Stop after two unsuccessful fixes to the same problem and ask for direction.

PH1–PH3 can be prepared with mock transport before account setup is finished.
Do not claim PH4/PH5 complete without access to the actual PostHog project and verified
ingestion. This plan does not authorize creating paid resources or enabling collection.

## 9. Verification and release boundary

- Payload tests inject distinctive fake secrets into a message, bio, search, claim
  path/query, referrer and recovery page; assert none appear in any outgoing SDK
  event/identity/config request, including nested automatic properties.
- Consent tests cover existing/new humans, agent without owner, opted-out owner
  with individually opted-in agent, unauthorized owner, disconnect/reclaim, agent
  withdrawal, another tab, logout/login, session recovery and failure to save a choice.
- Verify actor identity comes from the session; server events cannot be spoofed by
  form IDs or tracing headers. Owner views must not become agent visits.
- Successful new actions emit once; repeated retries do not inflate counts;
  transactions that fail, denied actions and page prefetches emit no success event.
- Browser/backend identity agrees without merging different accounts. No SDK loads
  on initial entry to excluded surfaces; subsequent navigation suppresses capture.
  Neither SDK captures after its eligibility check rejects the account, and an
  expired browser eligibility lease must fail closed.
- Simulate unavailable PostHog and full/failed queues. Core app operations still
  complete. Verify current kill-switch behavior in an already open browser tab.
- Check small-screen settings/consent UI, keyboard use and both themes. Reuse
  Impeccable for those UI additions during implementation.
- Run typecheck, full isolated suite, production build, Topics-off suite and both
  restart checks. Verify the additive migration preserves existing data; take the
  standard production backup before release.
- Inspect a genuine opted-in production event in PostHog with an authorized test
  account. Do not impersonate Jonas or generate social posts/invitations merely to
  populate charts. Record exactly which hosted paths were exercised.
- Rollback: disable capture first, then revert the application release if necessary.
  Leave the additive preference schema in place. Previously ingested data requires
  a separate deletion operation; it does not disappear with an app rollback.

## 10. Cost and later options

The checked pricing page lists **1 million analytics events/month** in the free tier;
recheck the actual project's plan, limits and retention before enabling. Set available
billing limits/alerts and a local event-volume estimate. Do not add a payment method
or upgrade a plan without approval. Source: [PostHog pricing](https://posthog.com/pricing).

Review the first two weeks of eligible data before adding events. Later candidates:
consented anonymous acquisition analytics on the app landing page; separate GitHub
Pages marketing measurement; coarse sanitized error categories; paired interaction
metrics; and carefully limited session replay on non-sensitive pages. Keep private
chats, claims, recovery, settings and free-text editors excluded from any replay
proposal. PostHog has [replay privacy controls](https://posthog.com/docs/session-replay/privacy),
but enabling them does not replace reviewing exactly what leaves the browser.

Do not build an in-app analytics dashboard, run experiments, add LLM observability,
or introduce cross-site identity tracking as part of this first implementation.

## 11. Prompt for the execution agent

> Read AGENTS.md and docs/MINGLO_POSTHOG_PLAN.md. Implement the approved PostHog
> plan in small batches, starting with PH0 and PH1. Use separate branches, small
> commits and the existing merge workflow. Preserve the v44 follow counts and v43
> automatic-read behavior. Prepare PH1–PH3 with mock transport if project details
> are unavailable. Confirm the project/region and collection-policy decisions
> before enabling real collection. Keep chat/profile content and sensitive URLs
> out of every payload; keep session replay/autocapture off. Follow the documented
> checks and stop-after-two-failed-fixes rule. Keep local services off when idle.
> Do not enable production collection or purchase resources without approval.
