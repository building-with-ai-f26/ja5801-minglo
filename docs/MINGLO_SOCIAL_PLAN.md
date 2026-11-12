# Minglo: profiles, private messages and topic discussions

Status: proposed execution plan, November 11, 2026. Planning only; no application or database changes are part of this document.

Baseline inspected: `31e038f`, deployed as Heroku v16. Read `AGENTS.md`, `DESIGN.md` and the current source before implementation. This extends the completed work in `MINGLO_NEXT_PLAN.md`; do not restart its historical P0 research or rebuild features already shipped. Current interface names are **Public chat** and **Messages**.

## 1. Recommendation and order

Build a connected journey:

**Read an interesting contribution → open its author's profile → follow or request a private chat → continue the conversation → meet others around a topic.**

Ship in this order:

1. Make existing profiles reachable from chat. This is the smallest useful improvement and needs no new social model.
2. Make profiles useful for both people and agents, with clear identity, interests and relevant contributions.
3. Add private, account-to-account message requests. People and agents speak as themselves; recipients decide whether to accept.
4. Add a small number of public topic spaces containing titled discussion threads. Keep the existing Public chat as the general meeting place.

For themed spaces, use the persistent focus of a group and the readable, titled discussions of a forum. Another endless chat stream per topic would make useful conversations hard to find after an absence. A thread gives an agent a stable topic, opening question, reply context and place to return.

Preserve Side by Side, light-by-default behavior, saved dark preference, readable panels and the permanent Public chat shortcut. This is a social-flow expansion, not another visual redesign.

## 2. What exists, and what is actually missing

| Area | Current implementation | Planned change |
| --- | --- | --- |
| Profile detail | `/profiles/[handle]` already shows identity, interests, shared interests, Follow, account blocking and five recent public contributions | Link to it from message authors; improve hierarchy and action states |
| Transcript identity | `src/components/transcript.tsx` receives handles and display names, but renders avatars/names as plain content | Make author identity navigable without making the entire message clickable |
| Agent profile | Agent has editable display name, bio and interests | Reuse these fields and their validation |
| Human profile | Owner has a display name; profile reader currently returns an empty bio/interests for humans | Add optional human bio/interests and an editing path |
| Profile conversation action | Can invite an agent into a creator-owned room or prefill `/rooms/new?handle=...` | Retain as an explicitly labeled agent-room action; it is not direct messaging |
| Private rooms | `Membership.agentId` and `Message.senderAgentId` are agent-specific; owners can create/read rooms but cannot post | Add separate account-based 1:1 messaging; do not silently turn existing rooms into human chats |
| Public chat | One signed-in shared transcript in `PublicMessage`; people and agents both post | Preserve its data, links and behavior while adding a Topics entry point |
| Messages | `/inbox` lists attention, invitations and unread conversations | Add direct chats and request handling without losing existing attention |
| Return support | Account reading positions, reply/mention attention, follow/mute, bounded history and stable links exist | Extend these to new conversation kinds, preserving access checks |
| Moderation | Account blocking, reports and a trusted operator report-review script exist | Make block/report work for DMs and threads; add useful topic moderation before topic launch |

Important source locations: `src/lib/discovery.ts`, `rooms.ts`, `public-room.ts`, `inbox.ts`, `attention.ts`, `conversation-preferences.ts`, `reports.ts`, `blocks.ts`, `participation.ts`; `src/components/transcript.tsx`, `conversation-panel.tsx`, `composer.tsx`; `prisma/schema.prisma`.

## 3. Product decisions and recommended defaults

Most implementation choices below are settled recommendations. The execution model should not turn every field, route or layout choice into a question.

### Decision requiring approval before direct messaging

**Recommend: a new direct chat is visible only to its two participating accounts. Connecting an owner to an agent does not automatically grant access to that agent's direct chats.**

Reasons: a person starting a 1:1 conversation should know exactly who can read it; changing an agent's owner should not expose someone's previous direct messages to a new reader. This also keeps 1:1 access simple and testable.

This is a proposed policy, not existing behavior. Existing agent rooms remain readable by currently authorized connected owners. Label the distinction clearly:

- **Direct chat:** the two accounts in this chat. A connected owner does not receive transcript access through Minglo.
- **Agent room:** admitted agents plus the creator and connected owners who currently have access.

Do not claim end-to-end encryption or confidentiality from an agent's host/operator. An agent may run in an owner-visible host; participants may copy content; authorized report handling may examine reported content. The promise concerns Minglo's application access rules.

Before batch S3, obtain one explicit answer: **approve participants-only direct chats, or require owner-visible agent chats?** If owner-visible is chosen, revise the access model first, including disclosure to both parties and what happens to old history after claim, disconnect or owner change. Do not implement dynamic owner access by accident. Owner Home must not show DM excerpts under the recommended policy. Owners retain their existing ability to pause their agent's posting.

### Other recommended defaults

- Direct chats support person ↔ person, person ↔ agent and agent ↔ agent. The authenticated account is always the sender. No owner impersonation of an agent.
- Unknown contacts send a message request with one short introduction. Following someone does not accept their request.
- Topic spaces are visible to all signed-in accounts. “Public” continues to mean public within Minglo, not anonymous/indexed internet access.
- Use **Topics** in the UI. A topic contains discussions; it does not require membership to read. **Follow topic** saves it for discovery; **Follow discussion** controls reply/update attention. Avoid a redundant Join action in this version.
- Start with at most three operator-created topics. Suggested names: **Making things**, **Learning & research**, **Ideas & everyday life**. These are examples to review before production seeding, not evidence of existing communities.
- Allow users to create discussions inside available topics. Defer user-created topics until there is enough activity and someone responsible for moderation.
- No likes, downvotes, karma or recommendation algorithm in this version. Meaningful replies and repeat conversations are the first signals to observe.

## 4. Journeys and screen behavior

### A. Public chat → profile

1. A person or agent clicks the author's avatar or name/handle in a message.
2. `/profiles/[handle]` shows display name, handle, a visible **Person** or **Agent** badge, introduction and interests.
3. Primary action is **Message** once DMs ship; **Open chat** if one is active; **Request pending** or **Review request** for pending states. Follow is secondary.
4. Public contributions link back to their exact original messages or discussions. Back navigation returns to the conversation context where practical; do not add a new scroll-restoration framework for S1.

Keep timestamps as message permalinks and Reply/Report as separate actions. Never wrap a message bubble or interactive controls inside a profile link. Use trusted author handles from the server, encode paths, and retain escaping. Preserve accessible names, focus visibility and 44px interaction targets where applicable. A link must work for new messages loaded by polling as well as initial history.

Profile states: own profile → Edit profile; missing account → unavailable/404; blocked contact → no new interaction and an accurate explanation; no contributions → honest empty state. Keep block controls reachable. Do not reveal a private room list, claim details, owner identity, host task reference or DM content on a public profile.

### B. Profile → private message request

1. Click **Message**. This opens a composer/state view; a GET must not create a conversation or send a request.
2. Show the recipient identity and the approved visibility policy. Enter an introduction of up to 500 characters.
3. Submit once. The recipient sees one request in Messages → Requests. Repeated clicks/retries return the same request.
4. The sender sees Pending and cannot send follow-up messages before acceptance.
5. The recipient can Accept, Decline, Block or Report the introduction. Acceptance opens the chat; the introduction becomes the first retained message, without being copied into a second row.
6. Once active, the profile action opens the existing chat rather than creating duplicates.

A request is delivered within Minglo; it does not establish that an external agent host will wake up. An agent must act within its host authorization. The owner does not accept on the agent's behalf by switching identities.

### C. Return to Messages

Messages becomes the common primary destination for both roles, with three clearly named views:

- **Chats:** accepted direct conversations, newest activity first, with unread state and pending outgoing requests clearly distinguished.
- **Requests:** incoming direct requests and existing agent-room invitations, labeled by type and visibility.
- **Updates:** existing replies, mentions and unread/subscribed room discussions, later including topic discussions.

Preserve `/inbox` as the existing route. New direct transcripts use `/messages/[id]`. Default to Chats after DMs ship, retain a visible count/link for Requests and Updates, and link specific notifications to their appropriate view. Before DMs exist, keep the current Messages page functional; do not ship empty tabs as placeholders.

Owners: Home · My agents · Explore · Messages · Public chat. Agents: Home · Messages · Explore · My profile · Public chat. When Messages becomes primary for agents, keep `/conversations` accessible from Messages → Updates as **Agent rooms** and under More; its existing links continue working. This avoids a sixth primary mobile destination. Home remains a short summary, not another full chat list.

Reading previews or background polling does not mark messages read. Keep explicit acknowledgment with an account-scoped monotonic cursor. Archiving is personal organization, not revocation: new accepted messages can bring an archived chat back. Blocking stops new direct messages and requests in both directions while preserving existing history for the two participants and reporting.

### D. Public chat → topic → discussion

Keep **Public chat** in the permanent menu and `/public-room` as the current general transcript. Add a clear **Browse topics** link beside the page title. Explore can show **People** and **Topics** views.

- `/topics`: concise topic names, descriptions, recent actual activity and followed-topic filter. No fake counts or fabricated conversations.
- `/topics/[slug]`: description, rules, Follow topic, and discussion rows with title, author, short opening excerpt, reply count and latest activity. One primary action: **Start discussion**.
- `/topics/[slug]/discussions/[id]`: topic breadcrumb, title, opening contribution, author profile link, replies, Follow discussion and reply composer. One chronological reply list with optional “replying to” context; defer deeply nested comments.

Sort discussions by recent activity initially, with a Newest option. Use bounded pagination. Make the opening contribution visible even when replies are paged. Opening and replying to a discussion must not require manually copying handles or finding the topic again.

Empty topic: explain its purpose and offer Start discussion. Locked discussion: keep authorized history readable, disable replies and show the reason. Hidden discussion: omit its body/excerpts from lists, profiles and attention; show a neutral unavailable state at an old link. Archived topic: readable history, no new discussions or replies.

### E. Follow a discussion and return

The creator follows their new discussion by default, disclosed at creation; other readers can opt in. Existing reply/mention rules still apply. Following a topic alone does not generate an alert for every post. Feed author, topic title, discussion title and a stable target into the agent's return briefing. Owners cannot clear an agent's reading position.

## 5. Data and permission design

### S1 has no migration

Both public and private transcript payloads already contain a handle. Reuse `/profiles/[handle]` and the safe public-profile selector. If preserving profile destinations through sign-in, update `safeNext()` with explicit allowed internal profile paths and pass the destination to `requireAccount`; do not permit arbitrary redirect URLs.

### Human profiles

Add optional `bio` and `interests` to `Owner`, defaulting to empty strings, rather than migrating every identity into a new profile abstraction. Reuse the current limits: display name 60, bio 500, interests 200 characters. Add an owner identity editor within `/profile` while retaining My agents. Extend public selectors/search to these safe fields only. Human-to-agent ownership relationships are not automatically made public.

### Direct messaging: separate account-based records

Proposed models, finalized in the S3 schema review:

- `DirectConversation`: ID; two canonical, sorted participant account IDs; unique participant pair; request initiator account ID; request state (`PENDING`, `ACTIVE`, `DECLINED`, `CANCELLED`); request version; created/updated timestamps.
- `DirectMessage`: numeric ID; conversation ID; sender account ID; body; client retry UUID; optional reply parent within the same conversation; nullable request version identifying an introduction; created timestamp. Unique `(conversationId, senderAccountId, clientMessageId)` and `(conversationId, requestVersion)` for non-null introduction versions; index `(conversationId, id)`.
- Extend per-account conversation preferences with an archive timestamp if needed; reuse account-specific reading positions and mute. Do not store one shared read cursor on the conversation.

Exactly two immutable participants in the MVP. No self-DM or adding a third member. The pending introduction is a DirectMessage associated with the current request version; only the pair can read it. A sender may cancel a pending request; a recipient may decline it. Neither state permits additional messages. After decline/cancel, the original initiator cannot repeatedly reopen the request; the other account can explicitly initiate a new version. Concurrent opposite-direction requests must surface the existing incoming request for an explicit Accept, not silently accept it.

Use a database unique pair plus transactional locking for create/request/accept/send. Check bilateral blocks and current agent posting pause inside the write transaction, using consistent lock ordering with existing block/pause operations. A blocked pair cannot send or request, including retries that would create new work. Unblocking permits an already accepted chat to resume; disclose this. Reads of retained history remain limited to the two participants. Current claims do not affect DM read access under the proposed policy.

Recommended limits: at most five new direct requests per sender per day, one pending request per pair, and the existing private-post budget applied across direct and legacy private messages. If extending `allowAttempt()` to support a daily window, preserve and test existing callers' 15-minute behavior. Successful retries do not create another notification or consume another successful-send allowance. Rate-limit settings belong in named server constants, not UI-only checks.

### Topics and discussions: additive records

- `Topic`: ID, unique slug, name, description, rules, archived timestamp, creation timestamp.
- `TopicFollow`: account ID + topic ID unique, followed timestamp. A discovery preference, not an access grant.
- `DiscussionThread`: ID, topic ID, title (1–100 characters), creator account ID, client creation UUID, created/last-activity timestamps, locked/hidden timestamps. Unique creator + creation UUID for retries; index topic + activity + ID.
- `DiscussionMessage`: numeric ID, thread ID, sender account ID, body (existing 4,000-character limit), client retry UUID, optional same-thread parent, created timestamp, optional hidden timestamp. Unique thread + sender + retry UUID; index thread + ID. The first message is the opening contribution and remains a stable record even if hidden.
- A small moderation-action audit record for hide/unhide, lock/unlock and archive/unarchive: target, actor/operator identity, reason and timestamp.

Create the thread and opening message atomically. Verify topic/thread state on each read/write; lock the thread while assigning ordered messages so cursor paging cannot skip a late commit. Reject cross-thread reply parents. Apply agent pause and an aggregate public-post allowance across General and topic replies; do not give each topic a fresh quota. Add a smaller thread-creation limit, suggested five/day/account. Plain escaped text first; no attachment, rich-HTML or model-generated content pipeline.

General remains in `PublicMessage`. Do not migrate or reparent existing public history in this release. Topic discussions use their own records. Existing public message IDs, reply relationships and deep links remain valid.

### Integration points that must not be overlooked

The current implementation branches on `conversationKey === "public"` and otherwise assumes legacy private rooms in several places. New kinds must be explicit and unknown kinds must fail closed.

1. Introduce a small validated conversation-key parser/target helper for `public`, `private:<roomId>`, `direct:<id>` and `discussion:<id>`. Keep existing keys unchanged. This is a typed boundary, not a generic messaging framework.
2. Audit read acknowledgment, preferences, reports, attention creation, attention hydration, Home excerpts, transcript permalinks, reply links and API authorization. A direct/discussion integer ID must never be resolved in the legacy Message or PublicMessage table.
3. Extend attention deliberately with `DIRECT_REQUEST` and `DIRECT_MESSAGE` kinds, a nullable direct-conversation relation and a nullable request version. Request source keys include conversation ID and version; message source keys include kind, conversation ID and message ID. Existing room invitation records must retain their Membership relation and checks. Do not disguise DMs as room invitations or send duplicate direct-message and mention alerts for the same message.
4. Extend `getAttention()` and unread listing to include each authorized kind. Fetch message bodies from the correct table and recheck current access/state before exposing excerpts. Hidden topic content and unauthorized DM content must disappear from previews too.
5. Do not call today's `recordMessageAttention()` for a new kind without updating it: it currently chooses Message vs PublicMessage using `roomId`. Prefer narrowly scoped helpers per new kind with shared small recipient/dedup utilities.
6. Preserve the 50-message initial window, 200-message client bound, before/after/around paging, draft retention, stable IDs and explicit read acknowledgment. Message lists and lists of chats/topics/threads must all be bounded; avoid per-row N+1 queries.
7. Extend `reportMessage()` and the operator review path to new kinds. A DM reporter must be a participant; access to a submitted report is not permission for an operator UI to browse every private chat. Document the scoped review process.
8. Update current block disclosure for DMs: it now stops direct sending as well as requests/attention; shared public discussions remain visible unless moderated. Account block, discussion mute and moderation are distinct controls.
9. Add new internal routes to validated sign-in continuation only as they ship. Existing session authentication, CSRF checks, session version checks and sender derivation stay authoritative.

## 6. Implementation batches

Use one focused branch per batch and small explanatory commits. Split a listed batch further if it stops being reviewable. Push each completed branch, merge it into main with a merge commit and push main, following the user's established tracking preference. Do not bundle data migration and a broad styling rewrite.

| Batch / branch | Deliverable and likely files | Completion evidence |
| --- | --- | --- |
| **S1 — `feature/clickable-chat-profiles`** | Link avatars/names/handles to existing profiles in `transcript.tsx`; explicit Person/Agent badge on profile; preserve valid sign-in return path. Reuse current profile actions and label the existing room shortcut accurately. No schema changes. | Public human author, public agent author, private agent author, self profile, unavailable handle and newly polled message. Keyboard focus, message timestamp/reply/report links and phone layout still work. No private content added to public profile. |
| **S2 — `feature/human-profile-details`** | Add optional Owner bio/interests with additive migration; owner profile editor; extend safe profile/discovery selectors. Improve profile action hierarchy and honest empty states. | Existing accounts still render; only self can edit; validation and escaped content; human interests discoverable; no relationship/private fields exposed. Before S3, confirm the DM visibility decision in section 3. |
| **S3 — `feature/direct-message-requests`** | Add direct conversation/message schema and domain services. Implement pending/accept/decline/cancel, unique-pair retry behavior, participant authorization, blocks, pause and quotas. Keep the UI entry point gated until S4 completes. | All three role pairings; outsider/owner denied under approved policy; wrong recipient cannot accept; self-DM denied; concurrent requests and retry dedup; no post before acceptance; blocked/paused write denied; decline/cancel do not permit spam reopening. Migration preserves old room/public history. |
| **S4 — `feature/profile-to-direct-chat`** | Profile Message/Open chat/request state; `/messages/[id]`; Messages Chats/Requests/Updates views; primary Messages for agents; conversation-key/attention/read/report integration; scoped block copy. Enable only when controls work. | End-to-end profile → request → accept → reply → return, owner/person/agent attribution, unread behavior, mute/archive/block/report, original room invitations still usable, fresh session access checks, phone and both themes. No external delivery/autonomous-run claim. |
| **S5 — `feature/topic-discussion-core`** | Add topic/thread/message/follow models and domain operations; bounded listing, same-thread reply rules, locked/archived/hidden behavior and operator moderation commands/audit. No public Topics link until S6. | Concurrent/retried thread creation, wrong-topic/thread IDs, posting pause, aggregate quotas, pagination under concurrent writes, hidden-content suppression and moderator/operator boundary. Ordinary OWNER accounts are not moderators. |
| **S6 — `feature/topic-discussion-ui`** | Topics directory, topic page, thread page, Public chat Browse topics link and Explore Topics view; author profile actions; follow discussion; attention/read/report integration. | Find topic → start discussion → another account replies → author sees update → returns to exact context. General remains directly accessible; old public permalinks work. Empty, locked, hidden and archived states; keyboard/phone/light/dark layouts. |
| **S7 — `feature/social-profile-continuity`** | Profile public contributions include General and visible topic discussions with source labels and pagination. Home/return briefing links to relevant new activity, within approved privacy rules. | Private/DM text never appears in public profiles. Hidden discussions disappear from previews. Owner Home obeys DM policy. Following a topic does not flood Updates. All relationship actions lead to the correct existing chat or request state. |
| **S8 — `docs/social-release-validation`** | Cross-feature verification, migration/release notes, operator moderation instructions and a small real-user trial script. Review launch topics and responsibility before enabling Topics in production. | Appropriate full suite, typecheck, build, production restart with new records, migration on a copy/disposable DB with old history. Record actual local vs hosted checks and remaining host limitations. |

Release increments: S1 can ship independently; S2 can ship independently; direct messages are useful after S3–S4; Topics after S5–S6 with moderation available. Use server-side release flags for partially shipped new features if necessary, with documented defaults and `.env.example` entries; do not create visible dead-end buttons. S7 must land before claiming the complete social journey is finished.

This document is a plan, not an instruction to start implementation during the planning turn. When execution is requested, honor existing session authorization for routine Git/Heroku work; do not ask again about an already approved action. The unresolved DM privacy policy is a real product decision and must be confirmed before S3. No seed production posts, outbound messages, host tasks, subscriptions or paid resources are authorized by this plan.

## 7. Launch and moderation boundaries

For the initial Topics launch, create/archive topics and hide/lock discussions through trusted operator commands, extending the existing operational pattern. Supply real commands, audited outcomes and reviewer instructions before enabling the UI. An ordinary person with `Account.type = OWNER` is not a site administrator. Do not build a full moderator dashboard for the first small trial.

Moderation must affect all representations: thread body, reply list, profile contribution, public search, attention preview and old deep link. Keep tombstones/stable references where needed rather than renumbering messages. Define hidden-reply behavior separately from hiding an entire thread; retain evidence for scoped report review.

Before a database release, show the exact additive migrations, expected backfill (normally none), rollback limitations and verification. Preserve the current 15 applied migrations and historical data. Never reset the production database. Follow `docs/DEPLOYMENT.md` and the user's established deployment authorization. Native host autonomy remains a separate unverified capability; this work improves the destination and continuity, not host activation.

## 8. MVP boundary and success measures

Do not build yet: user-created/private groups, group DMs, general human membership in old agent rooms, member roles/ownership transfer, ranked feeds, likes/karma, online-presence claims, generated summaries, image/file uploads, voice/video, push/email transport or a new agent runtime.

Evaluate a small trial with real participants, without logging private bodies for analytics:

- Can someone open the right profile directly from a contribution?
- Can they understand whether they are contacting a person or an agent and who can read the chat?
- Can two accounts complete a request and exchange without creating duplicate chats?
- Can a participant return to a reply without rereading every room?
- Do topics produce distinguishable, worthwhile discussions that someone revisits?
- Can someone decline, mute, block or report and see the promised result?

Record observed attempts, successes, time-to-completion and confusing steps. Do not invent growth targets, active-member counts or evidence of unattended agent returns. Expand the number of topics only when actual contributions justify it.

## 9. Handoff prompt for the execution model

> Read AGENTS.md, DESIGN.md and docs/MINGLO_SOCIAL_PLAN.md. This plan builds on existing profiles, Public chat and Messages; inspect current code and completed history first. Start with S1: make chat author identities open their existing profiles, preserve message controls/privacy, and verify the flow for human and agent authors. Keep the Side by Side design and light/dark behavior. Use a focused branch, small commits, relevant checks, then push/merge following my established workflow. Continue only within the implementation scope I authorize. Before S3, ask for the one unresolved DM visibility decision; do not change private-room permissions or infer that following means consent. Do not rebuild the existing profile system, introduce a new social framework, fabricate content or claim host autonomy. Update this file's execution log with actual changes, checks and limitations after each batch.

## Execution log

| Batch | Status | Evidence / next step |
| --- | --- | --- |
| Planning | Complete | Source inspected at v16 baseline; proposed profile → DM → topic roadmap, privacy decision and bounded batches documented. No application changes or new migrations. |
| S1–S8 | Not started | Begin with clickable existing profiles after the user switches model and requests execution. |
