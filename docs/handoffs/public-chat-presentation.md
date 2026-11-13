# Public chat message presentation — Heroku v40

The user approved implementing and deploying Emma's three Public chat suggestions.
All three shipped in `6ae19dc` to the existing `minglo-ja5801` app as **v40**.
Heroku reported the release succeeded; the canonical site is
https://www.minglo.club/public-room.

## Result and boundaries

- Replies show the original author's display name and a two-line text excerpt,
  linked to the exact original message. Public transcript reads include a
  one-level parent projection (ID, display name and at most 240 text characters),
  including parents outside the currently loaded page. It reads only the public
  message relation after the existing account check. No private/direct hydration.
- Each Public chat message has a 44px More control. Its native disclosure exposes
  Reply and Report on demand, closes when focus leaves or an action is selected,
  and restores summary focus on Escape. The keyboard outline uses theme tokens.
  Draft preservation, selected message identity and the existing actions remain.
- Adjacent messages from the same immutable account ID share attribution within
  five minutes and the same UTC date. Different senders, longer gaps, new dates
  and the first loaded message retain full attribution. Every message retains
  its timestamp/permalink and an accessible author label.

The presentation changes are gated by the existing Public chat prop/classes.
Private and direct chat presentation remains unchanged. Posting, quotas,
polling/cursors, read positions, permissions and reporting behavior are preserved.
No migration, dependency, config/credential change or production fixture was added.
The v36 tutorial, default light/saved themes, v38 agent guide and v39 toolbar
spacing remain included. Unrelated shared-checkout edits were preserved.

## Verification

- Production build and typecheck passed; formatting and diff checks passed.
- Full enabled suite: **145 passed**. Topics-disabled suite: **4 passed**.
- A final focus-outline-only CSS addition was followed by another production
  build/typecheck and **4 focused tests passed** on that final build. This subset
  is included in the 149 distinct cases, not four additional distinct cases.
- The focused checks cover older-page quotes, bounded public fields and
  authentication, exact-target navigation, grouping boundaries, draft-preserving
  reply selection/cancellation, correct report selection/cancellation, keyboard
  Enter/Escape/focus, real Playwright touch taps and overflow/44px targets for
  both account roles, themes and 1440/390/320px widths. Twelve page captures and
  eight expanded-action captures were saved; representative desktop/mobile and
  expanded-action screenshots were inspected.
- Main and topic production-mode restart checks passed on the final build.
  Full-suite fixtures were preserved for those checks. Ports 3117/3118, isolated
  `_test` databases and port-only test copies avoided the other session's runner.
- Standard production **backup b020 completed** before release. Heroku build
  passed and its release phase reported no pending migrations.
- After v40 succeeded, anonymous live Chrome checks passed: database health,
  root-to-www path forwarding, default light and saved dark, five page guards,
  Public chat API denial/no-store and zero browser page errors.

Authenticated production UI was not exercised. Authenticated behavior and
presentation were checked with disposable local accounts on the production
build; no production account, message or user session was created/impersonated.
No physical-device or screen-reader session is claimed.

Evidence: shared ignored `.local/public-chat-refinement/release-v40/`; the isolated
release checkout is `/private/tmp/minglo-public-chat-release.xlO8JP`.
