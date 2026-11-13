# Automatic read status — Heroku v43

The user approved implementing automatic reading state across Public chat, agent
rooms, direct chats and topic discussions, and explicitly approved deployment.
`46f253c` shipped to the existing `minglo-ja5801` app as **v43**, succeeded, on
November 13, 2026 (America/New_York). The canonical app is https://www.minglo.club/.

## Behavior and boundaries

The normal Mark conversation read button is removed. A shared browser component
observes message-end markers against the window viewport, including nested
scroller clipping. After 800ms of focused foreground visibility, it acknowledges
through the highest visible message for the current account. It deduplicates
saved IDs and has at most one request pending. Failures show an honest Retry
control; focus/connection recovery can retry. Topic openings are observed too.

The existing authenticated Server Action and account-scoped monotonic services
are unchanged. Reaching a later message acknowledges earlier history, preserving
the previous cursor semantics. Newer off-screen messages remain unread. Home,
profile/list previews, background tabs and JSON/API polling do not acknowledge
reading. An owner never acknowledges the agent's cursor. Reading a pending direct
introduction does not accept/decline it or clear its request-decision attention.
No new migration, dependency, permission or public read-receipt visibility exists.

App/agent instructions, engineering documentation and six local-demo captures were
refreshed. The personal-project GitHub Pages copy, v41 profile shortcut, v42
profile-visibility clarification, theme choices, toolbar spacing and earlier chat
presentation fixes remain included. Unrelated shared-checkout edits were preserved.

## Validation

- Main enabled suite: **150 passed**. Topics-disabled suite: **4 passed**.
- The full suite preceded an independent, already released profile-copy change.
  After including it, the final combined production build and typecheck passed;
  **8 automatic-read/profile cases** and **4 Topics-off cases** passed on that
  exact build. These are subsets of the 154 distinct cases, not extra case counts.
- New cases cover clipped/long bodies, older context, live arrivals, actual
  Chromium focus changes, separately simulated hidden-document visibility,
  background/API reads, deduplicated saves, both account roles, private/direct
  owner isolation, real pending-request decision attention and failed-save retry.
- Both production restart checks passed on the final build. The main check uses
  simulated background browser reads to preserve its full saved-state snapshot;
  foreground acknowledgment is exercised by the dedicated tests. Read positions,
  history, permissions, preferences, attention and tutorial state persisted.
- Six genuine app captures use only labeled local demo accounts. The product page
  passed 1440/768/390/320px layout, image/dimension/link and browser-error checks;
  39 local Markdown file/image links resolved. Published screenshot bytes matched
  all six approved local files.
- Standard **backup b023 completed** before release. Heroku build/TypeScript passed;
  release phase reported no pending migrations. After v43 succeeded, anonymous
  Chrome checks passed health, root-to-www path forwarding, default light/saved
  dark, five page guards, Public chat API protection and zero browser errors.

Early test harness corrections used real Chromium focus behavior (Playwright
normally forces headless focus), signed accounts out before switching, and
created pending attention through the real request service. The shared local
PostgreSQL server was being stopped externally, so final checks used a separate
loopback-only cluster on **55439**, disposable `_test` databases and app ports
3117/3118. A temporary restart readiness URL was corrected to 3117 before its
successful rerun. Assertions/timeouts were not relaxed and no tests were skipped.
The independent cluster was stopped after verification; shared PostgreSQL was
not stopped or reset by this work.

Authenticated production reading was not exercised: no production accounts,
messages or sessions were created/impersonated. Authenticated automatic behavior
was checked with disposable local accounts on the production build. No physical
device, screen-reader session or personal-agent autonomy trial is claimed.

Evidence: ignored `.local/automatic-read/` in the shared root. The isolated release
checkout is `/private/tmp/minglo-public-chat-release.xlO8JP`. Database data files
are excluded from the copied evidence.
