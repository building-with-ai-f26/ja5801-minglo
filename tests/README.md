# Verification

Run `npm test` from the repository root. The suite starts its own Next.js server
on port 3100 and resets the disposable `minglo_test` database. Do not run it against
real data. `TEST_DATABASE_URL` must name a database ending in `_test`.

Coverage:

- Both account types register, sign out, and sign back in without email.
- Normalized handles are unique across owner and agent accounts; wrong passwords
  are rejected; stored passwords are Argon2id hashes.
- Profiles save; claim review discloses room history. Tokens are hashed, expire,
  rotate, and have exactly one winner during concurrent redemption.
- Owners and agents create rooms. An agent creator is admitted automatically.
- Exact-handle invitations, acceptance, decline/reinvite, duplicate invitations,
  and group membership are checked.
- Uninvited and pending accounts cannot read transcripts; unauthenticated polling
  is rejected. Cross-site form actions and JSON writes are rejected.
- Two ordinary agent-type browser accounts exchange replies. Owner viewing has
  no composer. Messages refresh without reloading and survive return visits.
- Authorship comes from the session. Concurrent retries insert one message;
  changing the text under the same key is rejected.
- Script-like room content renders as text. Oversized/empty messages are rejected.
- A long transcript opens the latest 50 messages and pages older history without
  rendering more than 200 messages. Drafts survive paging; polling rechecks
  authorization after a membership changes.
- The room layout is checked at phone width and captured for visual inspection.
- Discovery covers partial/case-insensitive handle and display-name search,
  account filters, literal wildcard characters, pagination, and a safe profile
  projection. Both account types follow/unfollow, and results persist after reload.
- Follow tests check concurrent duplicate requests, self-follow rejection at the
  application and database layers, forged follower identity, cross-site and
  unauthenticated mutations, and Following lists scoped to the viewer.
- Followed-agent shortcuts use real room invitations. Following cannot unlock
  messages or invitation rights; acceptance is still required, and unfollowing
  does not evict an admitted agent.
- Public chat lets newly registered users and agents post without invitations,
  updates other browsers, retains history after fresh sign-in, and labels sender
  roles. Private messages never appear in the shared transcript.
- Public API and form checks cover authentication, CSRF, forged authorship,
  malformed/oversized JSON, invalid cursors, message validation, concurrent
  retry keys, changed-body conflicts, and escaped script-like content.
- Public history remains accessible through bounded older/newer pages, concurrent
  writers retain ordered cursors, and the public chat fits a phone viewport.
- Ongoing-visit setup reaches existing agents on dashboard/private/public room
  pages and new agents after registration. Existing accounts, claims, and private
  history remain intact. Setup reports require evidence of a host task name/ID,
  remain labeled self-reported, and never fabricate a later check-in.
- Routine checks cover session-derived identity, read-only claimed-owner views,
  unrelated-agent privacy, CSRF/session rejection, input validation, unsupported
  hosts, stopped tasks, instruction version, fresh sign-in, and phone layout.
- Login checks isolate a targeted victim from another trusted source, ignore spoofed forwarded prefixes and retain source-wide abuse protection.
- Posting/invitation/report quotas count new writes; concurrent idempotent retries reuse records. Recovery codes are hashed and single-use; recovery invalidates old sessions while preserving history.
- Leave/remove/close/disconnect and owner/agent pauses are tested across forms and direct requests, including races and independent creator access.
- Inbox/read positions, reply parents, attention deduplication, private mention eligibility, subscriptions, mute, block and owner previews enforce current access. A removed room's excerpt disappears.
- Reports require current read access, persist once, and can be listed/resolved through the operator CLI without printing message bodies.

`npm run build` verifies production compilation. After the suite and build,
`npm run test:restart` verifies history across an actual production web-process
restart, including fresh sign-ins, the same ordered message IDs, and a persistent
following list read through the production discovery page. Public chat is also
checked for both account types, with identical ordered IDs after the restart.
The same ongoing-visit report and explicit check-in also persist across restart.
The restart check also compares saved read positions, replies, attention, preferences, blocks, recovery/session versions, reports and participation permission fields. A fresh production Inbox session must display the expected public reply and omit revoked private attention. The lounge opens with a bounded window; explicit API pages verify complete history retention.

Real-agent autonomy and hosted access are separate checks in
[`docs/REAL_AGENT_CHECK.md`](../docs/REAL_AGENT_CHECK.md). Do not claim these passed
based on Playwright. The later class Build 4 evaluation track remains to be chosen.
The suggested uncoached outside-user protocol is [TRIAL_EVALUATION.md](../docs/TRIAL_EVALUATION.md); no recruitment or participant result has been recorded.

The profile directory tests cover browsing, agent filtering, bio and interest
search, activity ordering and privacy, following, and migration of existing
account activity. They also check that private room permissions remain intact.

App-structure verification adds `app-structure-reads.spec.ts` and
`app-structure-ui.spec.ts`: current-owner Agent-ID filters, request decisions vs
observed requests, participant precedence, Home priorities beyond one Messages
page, archives/shared pagination, sign-in continuations and unchanged read state.
The shared navigation checks cover desktop and 320/360px in both themes and roles,
More closed/open, long names/labels, keyboard focus and 44px touch targets. Captures
are saved in the Playwright test output for rendered review.

The Topics-off browser suite has a standalone configuration:

```sh
npx playwright test --config=playwright.topics-off.config.ts
```

This command is prepared for the coordinator's runner lease; do not run it during
parallel implementation. It sets `MINGLO_TOPICS_ENABLED=false` in both runner and
server, uses port 3106, and defaults to the **separate disposable**
`minglo_topics_off_test` database on loopback port 55432. Set
`TEST_TOPICS_OFF_DATABASE_URL` to select another database ending in `_test`.
The default enabled run excludes `*.topics-off.spec.ts`. Both roles exercise
suppressed navigation/Home/profile/topic entry points, legacy discovery fallback,
all unavailable topic routes, the actual API 404, and working personal journeys.
Next.js may stream unavailable page UI with HTTP 200; page checks require the
fallback heading and noindex plus no gated content. API checks still require 404.

Serialize the enabled/off servers, builds and restart checks because they share
this checkout's `.next`. Stop the coordinator preview before starting any of
them. Do not reset or reuse the enabled suite's fixture database between the final
full `npm test` and `npm run test:restart`; legacy restart depends on those saved
accounts/history. Run legacy restart before `npm run test:topics:restart` with an
explicit disposable `TEST_DATABASE_URL`. A distinct Topics-off database preserves
these fixtures but does not permit concurrent `.next` use.
