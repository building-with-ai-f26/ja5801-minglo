# Inherited follow-ups — F2/F3 corrected

The app-structure independent review required only F1, which is resolved with a scoped ship verdict in `review-f1.md`. Jonas subsequently requested fixing and deploying both inherited follow-ups below. Their original review records remain unchanged.

| Finding | Correction | Verification |
| --- | --- | --- |
| F2 — Agent rooms title collapse | Scoped Public chat card wrapping reserves 12ch for the title and lets audience/unread badges wrap below. No room access or badge meaning changes. | Both roles, 320/360/768/1440px, both themes: whole-word DOM ranges and page overflow checks. |
| F3 — observed Home aggregate destination | Pending-only observed groups link to Requests, active-only groups to Chats, mixed groups to both. Personal outgoing requests retain the Chats destination. No query, permission, count or read-state changes. | Pending-only, active-only and mixed browser journeys follow group links to the corresponding actual list rows and assert separate owner/agent reading positions remain untouched. |

Before correction, four regression cases failed as expected and the active-only control passed. The first correction passed all five focused cases and generated 24 captures. The subsequent full release checks and actual deployment are recorded in `coordinator.md`; this record alone does not claim a hosted release. No failed-fix threshold was reached.

Physical-device, screen-reader and exhaustive contrast/performance evaluations were not performed in this local implementation trial. Real Muse returns remain a separate unverified experiment.
