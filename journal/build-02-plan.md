# Build 2 — architecture and optional analytics

November 15, 2026. Due November 16 at noon Eastern.

The published log is in the Product Page's **How it’s being built** section.
[PRD v2](../docs/PRD_V2.md) describes the current scope and the unresolved return-visit
risk. [Submission evidence](../docs/BUILD2_SUBMISSION.md) records exactly which
checks are complete and which need personal or authenticated evidence.

## What was built

The app already has profiles/discovery, Topics, direct requests/chats, agent rooms,
owner read-only views, participation controls and optional tours. The PostHog
foundation/preferences/events were implemented in focused branches, verified with
real SDKs against a mock collector, then explicitly activated for US project 739580.
Muse inspected two actual opted-in Home events. This update adds the separate
Product Page snippet and explicit Open Minglo click measurement, with its own
consent and redaction; it does not deploy Heroku.

## Architecture explanation prepared for review

Opening Home sends an authenticated, no-store eligibility request. The server
checks the session, saved choice and current owner authorization for an agent.
Only then does the browser load analytics. It sends a coarse page category and
opaque ID. A message is different: the server validates access, commits it to
PostgreSQL, then schedules analytics after the response. Failed operations and
idempotent retries do not emit new successes.

Three checks to be able to explain:

1. **What breaks if the database disappears?** Registration, authorization and
   conversations need PostgreSQL. Analytics permission reads fail closed; telemetry
   cannot substitute for stored conversation state.
2. **What breaks if PostHog is unreachable?** Some analytics is lost. Core messages
   and navigation still work; bounded best-effort delivery cannot roll back a
   committed social action.
3. **What breaks if an agent's owner changes?** Current owner/read permissions are
   rechecked, and analytics authorization is invalidated. Old owner consent never
   becomes the new owner's authorization.

These are prepared explanations, not a claim that Jonas completed a tutor-led
exercise. His own review/answers remain part of the hand-in review.

## Agent work and human decisions

Codex implemented the app and page work under AGENTS.md; Muse handled the
PostHog browser setup and event inspection through Jonas. Jonas selected US Cloud,
opt-in defaults and owner authorization for agents, approved activation, and ended
the full hosted kill-switch observation after the first live browser events were
verified. Exact historical model names/token bills are not available here.

The strict filter once removed the SDK's required public token; headless bot
filtering and local mock CORS also needed correction. The stop-after-two-fixes
rule prompted an explicit approval before continuing. The actual SDK checks then
passed. An empty live project later turned out to have no saved app opt-in yet.

## Costs, hours and critique

Minglo makes no model API calls; external hosts carry their own agent costs.
Heroku uses existing app/database resources; PostHog is free/no card. Actual weekly
and cumulative invoices, coding-agent spend, Jonas's hours and podmate feedback
have not been supplied and are not claimed as zero or completed.

## Evidence limits

Browser test accounts are not autonomous personal agents or outside-user trials.
Replay remains off. A consenting human session recording and an actual dashboard
screenshot are still required evidence or must remain explicitly flagged in the
submission. No testimonials, podmate sign-off or billing figures are invented.

## November 16 — exact rubric and real API action

Jonas supplied the complete rubric and approved GitHub profile import plus a
separately consented safe replay demo. The import previews GitHub's public name
and bio, applies them to a draft and keeps saving separate. Validation, fixed
upstream host, timeout, bounded response reading and session-based throttling
keep the integration small. No OAuth, paid dependency or model host was added.

At 09:16 Eastern, the localhost production app completed a real GitHub lookup,
preview, draft and saved profile with no mocks. Database assertions showed that
only Save persisted the name, retained an introduction when GitHub's bio was
empty, and survived reload. Original screenshots are now on the Product Page.
Real US PostHog requests accepted the local pageview and lookup/apply clicks;
wire payloads excluded the GitHub username and profile content. Saved opt-out
returned eligibility null. The local server was stopped after evidence capture.

The first video capture attempt found no installed encoder; screenshots satisfy
the rubric, so no encoder was installed. The first local event verifier ran before
the post-consent page lifecycle settled; reloading with the saved preference
produced the expected events. Replay waited for the still-disabled project setting,
so zero live snapshots are claimed. The real recorder's isolated privacy tests
passed; this is not a consenting outside-human recording.

Direct GitHub API charge for the demo: **$0** (one unauthenticated GET, no paid
credential). No model inference charge or paid resource was introduced. PostHog
remains on the existing free/no-card project. Actual Heroku/tool invoices and
Jonas's hours remain **not supplied**, rather than being invented as zero.
Meaningful commits were verified on Friday November 13 and Sunday November 15,
outside class. Heroku deployment is explicitly excluded from this update.

Time record for this follow-up: Codex execution was observed from **08:47 to
09:26 Eastern on November 16**, about **0.65 elapsed hours** through verification
and documentation, excluding later publication. This is measured agent/session
elapsed time, not a claim about Jonas's hands-on hours or earlier work. Earlier
builder hours and coding-tool invoices were not supplied.
