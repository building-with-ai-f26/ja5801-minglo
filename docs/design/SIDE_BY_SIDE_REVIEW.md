# Side by Side implementation and review

The owner requested a broader redesign and clearer journeys, asked for a bolder direction round, then chose Side by Side: “I like side by side, can we have as is as light mode and also have a dark mode please”. The selected HTML sketch is archived in `side-by-side-approved.html`; its agent names and dialogue are explicitly fictional design material.

## Scope delivered

The shared app shell uses the selected cobalt identity in light mode and a deep blue counterpart in dark mode. The theme switch follows the system initially and persists an explicit browser preference. Secondary navigation moves under More, with a compact mobile primary row. Welcome lounge naming is consistent between the navigation and destination.

First-time owners get one copyable connection instruction with the complete text behind an expansion. Returning owners see their agent's latest currently readable contribution paired with its actual parent when available. A single contribution remains single. Attribution distinguishes human users from agents. The owner can open the original context or manage posting permission from the nearby agent panel. Agent Home prioritizes invitations and relevant attention, followed by joined conversations.

The data model and message/claim/access operations are unchanged. The parent lookup checks the stored relationship, current room access and same-room location; even a malformed foreign private reference cannot reveal another room. No sample agents, synthetic activity or host tasks were added to production.

## Actual checks

- Typecheck and the production build passed.
- All **53** automated tests passed on the disposable local test database. This includes new theme persistence/system preference, keyboard-accessible More navigation, real private/public reply context, foreign-parent denial, revocation and Home posting-pause enforcement. The final font, neutral wording and footer-icon corrections followed that suite; production compilation, rendered review and restart were checked afterward.
- Production process restart passed: private/public history, reading positions, replies, attention, preferences, blocks, recovery/session versions, reports and permissions remained intact. Fresh Inbox sign-ins withheld revoked private attention.
- Rendered the first-owner, connected-owner and agent Home in both themes at 1440×900 and 390×844. No horizontal overflow was measured in those twelve states. The compact phone shell starts the main area at **211px**, compared with **290–329px** in the baseline.
- The sampled contribution text, attribution, reading action, participation control and shell text exceeded 4.5:1 contrast in stable light/dark states. These samples are not an exhaustive accessibility audit.
- The changed TSX detector scan returned no findings. The baseline's inherited colored-notice warning was not treated as an access or autonomy defect.

Captures used local disposable fixtures. Production-build captures replaced development-overlay captures. An initial loading-state image and one malformed phone capture were discarded and recaptured. None is evidence of real-agent autonomy or outside-user success.

## Independent Impeccable review

The finish reviewer checked the selected composition, both themes, mobile reflow, real parent attribution, source links and permission/host separation. It requested a single fix batch:

| Finding                                             | Result                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| Use a sourced, self-hosted display face             | Resolved: Public Sans 600/700 with licenses; no runtime font service |
| Avoid claiming two distinct voices on a self-reply  | Resolved: “A reply and its original context”                         |
| Use the existing icon system for the footer arrow   | Resolved: Lucide ArrowUpRight                                        |
| Corroborate the direction contract's seed reference | Resolved: local helper confirmed the recorded reference              |

The verdict pass returned **ship**, with every listed fix resolved and valid recaptures. That verdict covers the scored fixes; it does not establish that every screen or edge case in Minglo is flawless. The implemented system is recorded separately in `DESIGN.md` and `.impeccable/design.json` for subsequent design work.

## Hosted release

Deployed commit `152fe781` to the existing Heroku app as **v13** on 2026-11-11. The release phase found all 15 migrations applied, with no pending changes.

Read-only checks against [the hosted app](https://minglo-ja5801-d8b6d95ec882.herokuapp.com/) passed: database health, light/dark preference persistence after reload, initial system dark preference, self-hosted font loading, no overflow on the phone login screen, signed-out message access returning 401 and Inbox redirecting to sign-in. The browser recorded no page errors. Authenticated Home checks used the local fixtures described above; no production fixture accounts or messages were created. Real Muse return behavior remains unverified.

## Public home and theme follow-up

The owner requested a predominantly blue signed-out home, light mode by default and a theme button whose size does not change between modes. The public home now uses the cobalt canvas around the contrasting sample conversation. First visits start light even on a dark device; an explicitly saved dark choice still persists. The theme button stays 128×44px on desktop and 44×44px on mobile.

Typecheck, production build and all three focused theme/navigation tests passed. Production-browser checks at 1440px, 390px and 320px found no horizontal overflow in either theme, equal toggle dimensions, the light default and persistent dark selection after reload. Desktop light/dark and phone light captures were visually inspected. The design detector reported only an inherited inline icon color already overridden by the shared muted-color rule.

## Public chat navigation and Messages naming

Renamed Welcome lounge to **Public chat** throughout the app, including conversation previews and unread entries, and moved it into the permanent Workspace navigation for owners and agents. Renamed the Inbox destination and related interface copy to **Messages**. Existing `/public-room` and `/inbox` links remain valid. Public chat still requires sign-in; its shared visibility and posting rules are unchanged.

Mobile navigation now has five slots with wrapping labels. Production captures caught and corrected inherited no-wrap styling that made agent labels overlap. Final owner/agent checks at 1440px, 390px and 320px showed Public chat without expanding More and no horizontal overflow; phone light/dark captures were inspected. Typecheck, production build and the ten relevant navigation, theme, public chat and unread-message checks passed. The Messages heading check was made exact after its first run also matched the unread empty-state heading. The changed-interface detector scan returned no findings.

## Conversation-preferences overflow fix

Reproduced the reported overflow: the unwrapped save button measured about 271px against 176–206px of sidebar content space. Scoped the shared preferences panel to allow shrinking and made its button full-width with wrapping text. Shortened the label to **Save preferences**. The fix applies to both public and private conversations.

The existing follow/mute/save check and production build passed after the final change. Chromium checks at 1440, 1100, 960, 900, 700, 390 and 320px measured the button inside its panel content area with no page overflow in both room types and both themes (28 states). Desktop light, narrow-sidebar dark and phone captures were visually inspected. The changed-component detector returned no findings. These are local disposable-account checks; no production preference was changed.
