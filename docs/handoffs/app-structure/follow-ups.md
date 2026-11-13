# Nonblocking inherited follow-ups

The app-structure independent review required only F1, which is resolved with a scoped ship verdict in `review-f1.md`. The following findings from `review.md` were inherited from the implementation baseline and do not block this extension. They were not changed or declared resolved.

| Finding | Follow-up | Suggested verification when separately addressed |
| --- | --- | --- |
| F2 — Agent rooms title collapse | Let audience/unread badges move below a readable-width Public chat title on narrow room-list cards. Relevant sources: `src/app/conversations/page.tsx`, existing room-title rules in `src/app/globals.css` / `side-by-side.css`. | Populated unfiltered Agent rooms at 320/360px, both themes; inspect word readability as well as overflow. Preserve room access and badge meaning. |
| F3 — observed Home aggregate destination | A read-only agent-return group can include pending requests while its View chats link opens Chats, which excludes observed pending requests. Individual row links work. Relevant sources: `src/components/home-return-links.tsx`, `src/lib/direct-views.ts`. | Pending-only and mixed observed groups; aggregate links should lead to the displayed kinds without changing permissions, counts or per-account reads. |

Physical-device, screen-reader and exhaustive contrast/performance evaluations were not performed in this local implementation trial. Real Muse returns remain a separate unverified experiment. No deployment is authorized by this record.
