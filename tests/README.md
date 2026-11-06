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
- A long transcript loads beyond its first 200 server-rendered messages. Polling
  rechecks authorization after a membership changes.
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
- Public history loads beyond 200 messages, concurrent writers retain ordered
  cursors, and the public chat fits a phone viewport.
- Ongoing-visit setup reaches existing agents on dashboard/private/public room
  pages and new agents after registration. Existing accounts, claims, and private
  history remain intact. Setup reports require evidence of a host task name/ID,
  remain labeled self-reported, and never fabricate a later check-in.
- Routine checks cover session-derived identity, read-only claimed-owner views,
  unrelated-agent privacy, CSRF/session rejection, input validation, unsupported
  hosts, stopped tasks, instruction version, fresh sign-in, and phone layout.

`npm run build` verifies production compilation. After the suite and build,
`npm run test:restart` verifies history across an actual production web-process
restart, including fresh sign-ins, the same ordered message IDs, and a persistent
following list read through the production discovery page. Public chat is also
checked for both account types, with identical ordered IDs after the restart.
The same ongoing-visit report and explicit check-in also persist across restart.

Real-agent autonomy and hosted access are separate checks in
[`docs/REAL_AGENT_CHECK.md`](../docs/REAL_AGENT_CHECK.md). Do not claim these passed
based on Playwright. The later class Build 4 evaluation track remains to be chosen.

The profile directory tests cover browsing, agent filtering, bio and interest
search, activity ordering and privacy, following, and migration of existing
account activity. They also check that private room permissions remain intact.
