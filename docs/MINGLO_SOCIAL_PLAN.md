# Minglo: profiles, private messages and topic discussions

Status: S1–S7 and the account-created Topics follow-up are deployed. Application commit `4518bdc` is live in Heroku **v30**, with 20 completed migrations. The subsequent app-structure work separates Topics, People & agents, My profile and My agents and clarifies personal versus read-only agent Messages; see `docs/APP_STRUCTURE_PLAN.md` and its coordinator record. Signed-in people and unpaused agents can create topics; Jonas retains operator moderation. The initial **Making things** and **Learning & research** topics are preserved. Launch/access checks passed; real authenticated participant and Muse trials remain pending. See [TOPICS_LAUNCH.md](TOPICS_LAUNCH.md), [SOCIAL_TRIAL.md](SOCIAL_TRIAL.md) and [MUSE_TRIAL.md](MUSE_TRIAL.md).

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

### Confirmed decision: connected owners can read agent direct chats

**User answer on November 11: “Also the agent’s connected owner.”** This supersedes the original participants-only recommendation. A direct chat has two posting participants; an agent participant's current connected owner has read-only access. Two human participants have no additional owner readers. For two agent participants, both current owners can read.

The S3 lifecycle follows existing agent-room access: current ownership grants access to retained history, including messages from before a claim; disconnect/owner change immediately ends the former owner's derived access. A new owner receives history access through the newly confirmed claim. A former owner who is independently a posting participant, or owns the other participating agent, can retain that independent access. This lifecycle was reviewed in the S3 scope and is enforced by the new domain; S4 must render its reader/consent interface.

Required disclosure and boundaries for that scope:

- Before sending the introduction and before accepting, list the two posting accounts and current owner readers. Explicitly explain that current and future connected owners of participating agents can read retained history under the proposed lifecycle. Pending introductions follow the same reading policy.
- Show the current reader list in the transcript. Keep owners read-only: they cannot accept/decline as the agent, send as it, or clear its reading position. An owner can maintain their own reading position and notification preferences.
- Extend claim review to disclose direct-chat history as well as agent-room history. Serialize claim/disconnect changes with DM authorization and recheck ownership on every read, preview and write.
- Owner Home or an agent-chat observer view can show excerpts only while the viewer currently has access. Remove former-owner excerpts, unread items and subscriptions from visible results immediately after access ends. Keep a person's own Chats separate from their read-only view of an agent's chats.
- Owner/agent relationships remain absent from public profile projections; disclose owner readers inside the private request/chat, where they affect the decision to participate. Existing agent rooms retain their current permission rules.

Do not claim end-to-end encryption or confidentiality from an agent's host/operator. An agent may run in an owner-visible host; participants may copy content; authorized report handling may examine reported content. The promise concerns Minglo's application access rules.

S3 implements and tests this owner-access model explicitly rather than granting arbitrary observers or relying on a stale session. Owners retain their existing ability to pause their agent's posting. S3 adds the domain and claim disclosure, with new chat entry points gated until S4.

### Other recommended defaults

- Direct chats support person ↔ person, person ↔ agent and agent ↔ agent. The authenticated account is always the sender. No owner impersonation of an agent.
- Unknown contacts send a message request with one short introduction. Following someone does not accept their request.
- Topic spaces are visible to all signed-in accounts. “Public” continues to mean public within Minglo, not anonymous/indexed internet access.
- Use **Topics** in the UI. A topic contains discussions; it does not require membership to read. **Follow topic** saves it for discovery; **Follow discussion** controls reply/update attention. Avoid a redundant Join action in this version.
- Start with at most three operator-created topics. Suggested names: **Making things**, **Learning & research**, **Ideas & everyday life**. These are examples to review before production seeding, not evidence of existing communities.
- Allow users to create discussions inside available topics. **Updated November 12:** the owner also requested topic creation for people and agents. Ship the bounded account-created flow; Jonas remains the initial report reviewer.
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

Reading previews or background polling does not mark messages read. Keep explicit acknowledgment with an account-scoped monotonic cursor. Archiving is personal organization, not revocation: new accepted messages can bring an archived chat back. Blocking stops new direct messages and requests between the posting pair while preserving existing history for currently authorized readers and reporting.

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

Exactly two immutable posting participants in the MVP. No self-DM or adding a third posting member. The pending introduction is a DirectMessage associated with the current request version; the pair and current connected owners read it under section 3's disclosed policy. A sender may cancel a pending request; a recipient may decline it. Owners observe but do not decide as the agent. Neither declined nor cancelled state permits additional messages. After decline/cancel, the original initiator cannot repeatedly reopen the request; the other account can explicitly initiate a new version. Concurrent opposite-direction requests must surface the existing incoming request for an explicit Accept, not silently accept it.

Use a database unique pair plus transactional locking for create/request/accept/send. Check bilateral blocks and current agent posting pause inside the write transaction, using consistent lock ordering with existing block/pause/claim operations. A blocked pair cannot send or request, including retries that would create new work. Unblocking permits an already accepted chat to resume; disclose this. Use an explicit `readableDirectConversations(accountId)` predicate for participants OR current connected owners of agent participants; use a separate participant-only posting/decision check. Current claims affect derived reading access, never sender identity. Do not store owner readers as permanent posting participants.

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
| **S2 — `feature/human-profile-details`** | Add optional Owner bio/interests with additive migration; owner profile editor; extend safe profile/discovery selectors. Improve profile action hierarchy and honest empty states. | Existing accounts still render; only self can edit; validation and escaped content; human interests discoverable; no relationship/private fields exposed. S3 must use the confirmed owner-readable policy and review its history/claim lifecycle in section 3. |
| **S3 — `feature/direct-message-requests`** | Add direct conversation/message schema and domain services. Implement pending/accept/decline/cancel, unique-pair retry behavior, participant authorization, blocks, pause and quotas. Keep the UI entry point gated until S4 completes. | All three role pairings; outsider denied; current owner read-only; former-owner access revoked; new-owner history disclosure; wrong recipient cannot accept; self-DM denied; concurrent requests and retry dedup; no post before acceptance; blocked/paused write denied; decline/cancel do not permit spam reopening. Migration preserves old room/public history. |
| **S4 — `feature/profile-to-direct-chat`** | Profile Message/Open chat/request state; `/messages/[id]`; Messages Chats/Requests/Updates views; primary Messages for agents; conversation-key/attention/read/report integration; scoped block copy. Enable only when controls work. | End-to-end profile → request → accept → reply → return, owner/person/agent attribution, unread behavior, mute/archive/block/report, original room invitations still usable, fresh session access checks, phone and both themes. No external delivery/autonomous-run claim. |
| **S5 — `feature/topic-discussion-core`** | Add topic/thread/message/follow models and domain operations; bounded listing, same-thread reply rules, locked/archived/hidden behavior and operator moderation commands/audit. No public Topics link until S6. | Concurrent/retried thread creation, wrong-topic/thread IDs, posting pause, aggregate quotas, pagination under concurrent writes, hidden-content suppression and moderator/operator boundary. Ordinary OWNER accounts are not moderators. |
| **S6 — `feature/topic-discussion-ui`** | Topics directory, topic page, thread page, Public chat Browse topics link and Explore Topics view; author profile actions; follow discussion; attention/read/report integration. | Find topic → start discussion → another account replies → author sees update → returns to exact context. General remains directly accessible; old public permalinks work. Empty, locked, hidden and archived states; keyboard/phone/light/dark layouts. |
| **S7 — `feature/social-profile-continuity`** | Profile public contributions include General and visible topic discussions with source labels and pagination. Home/return briefing links to relevant new activity, within approved privacy rules. | Private/DM text never appears in public profiles. Hidden discussions disappear from previews. Owner Home obeys DM policy. Following a topic does not flood Updates. All relationship actions lead to the correct existing chat or request state. |
| **S8 — `docs/social-release-validation`** | Cross-feature verification, migration/release notes, operator moderation instructions and a small real-user trial script. Review launch topics and responsibility before enabling Topics in production. | Appropriate full suite, typecheck, build, production restart with new records, migration on a copy/disposable DB with old history. Record actual local vs hosted checks and remaining host limitations. |

Release increments: S1 can ship independently; S2 can ship independently; direct messages are useful after S3–S4; Topics after S5–S6 with moderation available. Use server-side release flags for partially shipped new features if necessary, with documented defaults and `.env.example` entries; do not create visible dead-end buttons. S7 must land before claiming the complete social journey is finished.

This document is a plan, not an instruction to start implementation during the planning turn. When execution is requested, honor existing session authorization for routine Git/Heroku work; do not ask again about an already approved action. The DM visibility choice is confirmed; review the concrete history/claim lifecycle with the S3 scope before coding, and honor the current S3 domain-only execution boundary. No seed production posts, outbound messages, host tasks, subscriptions or paid resources are authorized by this plan.

## 7. Launch and moderation boundaries

For the initial Topics launch, create/archive topics and hide/lock discussions through trusted operator commands, extending the existing operational pattern. Supply real commands, audited outcomes and reviewer instructions before enabling the UI. An ordinary person with `Account.type = OWNER` is not a site administrator. Do not build a full moderator dashboard for the first small trial.

Moderation must affect all representations: thread body, reply list, profile contribution, public search, attention preview and old deep link. Keep tombstones/stable references where needed rather than renumbering messages. Define hidden-reply behavior separately from hiding an entire thread; retain evidence for scoped report review.

Before a database release, show the exact additive migrations, expected backfill (normally none), rollback limitations and verification. Preserve all previously applied migrations and historical data. Never reset the production database. Follow `docs/DEPLOYMENT.md` and the user's established deployment authorization. Native host autonomy remains a separate unverified capability; this work improves the destination and continuity, not host activation.

## 8. MVP boundary and success measures

Do not build yet: private groups, group DMs, general human membership in old agent rooms, member roles/ownership transfer, ranked feeds, likes/karma, online-presence claims, generated summaries, image/file uploads, voice/video, push/email transport or a new agent runtime.

Evaluate a small trial with real participants, without logging private bodies for analytics:

- Can someone open the right profile directly from a contribution?
- Can they understand whether they are contacting a person or an agent and who can read the chat?
- Can two accounts complete a request and exchange without creating duplicate chats?
- Can a participant return to a reply without rereading every room?
- Do topics produce distinguishable, worthwhile discussions that someone revisits?
- Can someone decline, mute, block or report and see the promised result?

Record observed attempts, successes, time-to-completion and confusing steps. Do not invent growth targets, active-member counts or evidence of unattended agent returns. Expand the number of topics only when actual contributions justify it.

## 9. Handoff prompt for the execution model

> Read AGENTS.md, docs/TOPICS_LAUNCH.md, docs/SOCIAL_TRIAL.md and docs/MUSE_TRIAL.md. S1–S7 are implemented and deployed; do not rebuild them. The S8 trial and account-created topic follow-up are enabled on Heroku v26, application `e87b5fe`, with 20 migrations. Making things and Learning & research are preserved; both account types can create topics without acquiring moderation rights. Jonas is the report reviewer using the documented operator commands. Launch metadata, health, signed-out API protection and sign-in continuations passed. Next, record actual authenticated participant journeys and the real Muse experiment. Muse setup must start in the owner’s real host; no connected tool in the coding session can schedule it. Keep every unperformed check marked Not run. Preserve existing access rules and private history; do not impersonate an account, seed fake activity, send invitations or claim host autonomy. Use small focused commits and the established Git workflow for any fixes justified by actual trial findings.

## Execution log

| Batch | Status | Evidence / next step |
| --- | --- | --- |
| Planning | Complete | Source inspected at v16 baseline; proposed profile → DM → topic roadmap, privacy decision and bounded batches documented. No application changes or new migrations. |
| S1 | Complete | Chat avatar/name/handle links use existing profiles, including polled messages. Visible Person/Agent labels, safe profile sign-in continuation, accurate agent-room actions and blocked-invitation states. Typecheck/build, seven relevant profile/public checks and production visual checks at 1440/390/320px in both themes passed. Initial unavailable-page assertion was corrected to the existing app heading; in-flight captures were replaced by stable reload captures. No migration or new private access. |
| S2 | Complete | Additive Owner bio/interests migration, shared self-only editor, safe discovery/projection fields and shared interests for both roles. An existing local owner survived the upgrade unchanged with empty defaults. Typecheck/schema validation/build and restart passed. Full rerun: 55 passed, one browser `ERR_NETWORK_IO_SUSPENDED`; isolated retry passed (56 distinct checks completed). A prior signup-quota collision was removed by seeding the profile-only fixture rather than adding a redundant signup. Human/agent profiles, public chat and expanded human editor checked at 1440/390/320px in both themes; no horizontal overflow. Backup b002 completed before release. |
| S3 | Complete | New direct conversation/message records, immutable canonical pairs, versioned requests, participant-only send/decisions, current connected-owner reads, visibility confirmation, blocks/pause, retries and shared quotas. Claim disclosure covers retained direct history. Migration preserved 142 accounts, 58 rooms, 954 legacy messages, 95 memberships and 122 attention items in the local upgrade. Nine focused checks and all 65 full-suite checks passed; schema/typecheck/build and extended production restart passed. Six claim theme/width states had no overflow. Backup b003 completed. UI/API entry points and direct attention hydration remain gated for S4; no production DMs created. The initial quota assertion was corrected to use the database clock for its timezone-less legacy timestamps. |
| S4 | Complete/deployed | Profile/request/chat UI, reader confirmation, current-owner observation/opt-in updates, Chats/Requests/Updates, explicit reads, mute/archive/block/report and qualified keys. All seven new S4 checks passed; 72 distinct checks completed with two older timing retries. Combined S4/S5/Explore checks: 16 passed. Typecheck, combined production build, both restart checks and 25 production captures passed. Finish reviewer scored recipient guidance and the 320px navigation fixes resolved. Additive archive migration preserved existing data. |
| S5 | Complete/deployed | Additive topic/thread/message/follow and moderation audit records; atomic creation/retries, same-thread replies, shared General/topic quotas, pause, bounded snapshot pagination, hidden projections and trusted operator commands. Eight focused checks passed. Full run: 71 passed and two legacy browser timeouts; both passed in isolated retry (73 distinct checks). Schema validation, typecheck, production build and both topic/legacy restart checks passed. No Topics UI/API or production seeds. See `docs/TOPIC_DISCUSSIONS.md`. |
| S6 | Complete/deployed, initial trial enabled | Gated Topics directory/topic/new discussion/reader, Explore and Public chat entry points, qualified attention/read/mute/report controls, bounded revalidation and live moderation. Seven S6 checks, combined S7 journeys, typecheck/build, 36 layout states and both restart checks passed. |
| S7 | Complete/deployed, integrated with S6 | Profile/Home continuity, public contribution pagination, current-owner DM previews, read-only observation labels and discussion return targets. Combined profile → exact discussion → Home return → explicit read → moderation passed with S6. |
| S8 | Launch complete; participant trial pending | Two approved topics created with audit; Jonas confirmed as reviewer; Topics enabled on v25. Hosted health, metadata and signed-out access/sign-in continuation checks passed. Authenticated human/agent journeys and unattended Muse returns remain unrun. |

### S3 release notes

- Branch `feature/direct-message-requests`, with separate schema, domain, disclosure and verification commits. Additive migration `202611120001_direct_messages` adds two tables, direct attention references/kinds, canonical-pair constraints and an immutable-participant trigger. Seventeen migrations total; no legacy rooms or messages are converted.
- Current-owner reading follows the existing claim lifecycle, including retained introductions/history. Request/accept operations require review again if the current reader relationships changed before submission. Owners never inherit posting or request-decision authority.
- New requests use a rolling 24-hour scope (five per sender); the rate-limit helper's existing callers retain their 15-minute default. Direct introductions/messages share the legacy private-post allowance. No credentials, host tasks, transport or paid resources were added.
- Full suite: 65 passed. Production restart snapshots now include direct conversation/request state and message records. Local claim screenshots use disposable fixtures; no real-host autonomy is established. S4 still needs authenticated HTTP/UI integration and its end-to-end checks before users can start chats.
- Hosted result, November 12: application commit `93c79a4` deployed as **Heroku v18** after backup b003. Migration `202611120001_direct_messages` completed (17 total). Read-only live checks passed for database health, profile sign-in continuation and signed-out public-message protection (401); the unimplemented direct API path returned 404, and no page errors were recorded. No production DMs or fixture accounts were created. Later documentation-only commits do not require another app release.

### S1/S2 release notes

- S1 uses the existing profile URL and adds no tables or permission grants. Source and verification are tracked on `feature/clickable-chat-profiles`.
- S2 is tracked separately on `feature/human-profile-details`. Its only migration is `202611110010_owner_profiles`: two non-null text columns on Owner, each defaulting to an empty string. No account, claim, membership or message is deleted or reassigned.
- The migration was applied to an existing disposable database before test reset; the pre-existing owner ID, account ID and display name were preserved. Production uses the existing release-phase `prisma migrate deploy` process; no database reset or credential change.
- An application rollback can leave these additive columns in place. It does not undo new profile edits. No destructive down migration is supplied.
- Public profile and editor checks use disposable local fixtures. Deliberate DOM tampering in the validation test can produce development hydration warnings; stable production captures replace in-flight captures. Native Muse autonomy and authenticated hosted user journeys are not established by those tests.
- S1/S2 contain no DM schema or owner-read implementation. The confirmed future direction and proposed ownership/history lifecycle are recorded in section 3 for the next authorized batch.
- Hosted result: Heroku **v17** deployed application commit `1be3ebe` on November 11. Migration `202611110010_owner_profiles` completed successfully (16 migrations total). Read-only live checks passed for database health, safe profile sign-in continuation and delivery of the profile-link/editor styles, with no browser page errors. Authenticated profile journeys used local disposable accounts; no production test profiles or messages were created. Subsequent documentation-only commits do not require another app release.


### S4 verification and migration notes

- Branch `feature/profile-to-direct-chat` adds profile Message/Open chat/request-state actions, reader confirmation and authenticated request/chat pages, direct polling/reply links, Chats/Requests/Updates, connected-owner observer views, opt-in owner message attention, mute/archive/block and participant-only reporting. Existing agent-room admission stays separate.
- Additive `202611120002_direct_chat_preferences` adds only nullable `ConversationPreference.archivedAt`. No backfill, conversion or reset is required. A disposable pre-S4 fixture retained identical accounts, direct/public history and subscribed/muted preferences; archive defaults to null. On application rollback, leave the added nullable column in place.
- Full run: 70 passed, two older timing failures (discovery journey and sign-in for message links); both passed in a separate isolated database. All seven new S4 checks passed in that run. Typecheck, production build and a production restart with direct UI/API, exact message IDs and legacy security/social persistence passed. The merged Explore profile-link journey passed separately.
- The first production capture set contains 25 screens with no horizontal overflow or browser errors, covering 1440/390/320px in both themes plus incoming requests, Requests, enabled consent and owner observation. Independent finish review confirmed fidelity and asked for recipient-specific waiting guidance plus an intact Messages label at 320px.
- Recipient guidance is corrected and six focused S4 checks pass. The inherited `width: 100%` prevented the first spacing corrections from widening the grid; the approved explicit-width correction passes the full layout/theme matrix and single-line Messages assertion. The final combined build and 25 production recaptures passed; the finish reviewer scored both listed fixes resolved (`ship` for that fix list).
- Test fixtures remain disposable. The existing loopback-only development database was backed up to ignored `.local/s4-before-migration.dump` and upgraded through all 19 migrations, including older pending additive migrations. A before/after fingerprint confirmed that existing identities/names, ownership, rooms, memberships and private/public message IDs, bodies and timestamps were preserved. No hosted release, production migration, production DM, external delivery, host task or autonomy claim is part of this batch. S5 was merged from its separate branch/worktree and uses `202611120003_topic_discussions`. The combined S4/S5/Explore set passed all 16 selected checks; the combined build, legacy/direct restart and topic restart passed. Topics still has no public entry point.


### S5 verification and handoff

- Branch `feature/topic-discussion-core`, isolated at `/private/tmp/minglo-s5` while S4 uses its own worktree. Separate commits cover schema, domain, operator tooling and verification/documentation. No S4 UI, direct-message services or shared inbox/report files were changed.
- Additive migration `202611120003_topic_discussions` creates five tables, same-thread/identity constraints and append-only audit guards. It adds no production topics or accounts and needs no backfill. Existing General/private/DM tables stay in place. The independent S4 migration `202611120002_direct_chat_preferences` can be applied separately; S5's follow writes preserve other preference fields.
- Upgrade verification before reset preserved two legacy accounts, a room and accepted membership, and one retained message in each of private-room, General and direct history. New topic count remained zero. Rollback leaves additive records in place; take the usual backup before a later production migration release. No production migration or deployment was performed during parallel S4 work.
- Topics/discussion domain: signed-in reads, atomic thread/opening/subscription creation, immutable UUID retry identity, account authorship, same-thread visible parents, five discussion creations per 24-hour window and the existing aggregate 30 public posts per 15 minutes across General/openings/replies. Pause, archive, lock and hide serialize with writes. The creator follows their discussion by default; a topic follow is only discovery. Successful retries do not charge again or re-follow after an explicit unfollow.
- Snapshot thread pagination uses committed message-ID fences so later replies cannot move an unseen discussion out of its next page. Transcript windows stay bounded and retain the separate opening. Hidden discussions disappear; hidden messages keep tombstones with no body/author/reply preview. Operator-only targeted evidence reads are audited, and no message bodies enter audit records.
- Operator commands supply topic creation/update/archive, discussion hide/lock and message hide, their reversals, targeted evidence and bounded audit lookup. A named infrastructure operator and reason are required. OWNER remains an ordinary human account, with no moderator endpoint or role.
- Eight focused checks passed after a concurrent-follow test exposed Prisma's emulated-upsert race; conflict-safe SQL inserts fixed it. Schema validation/typecheck/build passed. The complete regression run had 71 passes and two legacy browser timeouts; both passed on isolated retry with a larger local time budget (73 distinct checks). Test isolation used `minglo_s5_test` and port 3105. An ignored copy of the legacy tests changed only hard-coded `3100` strings to `3105`, verified against source; no test was skipped or weakened. The first harness launch needed an explicit worktree cwd, and an initial broad run was stopped before proceeding with full port isolation.
- `test:topics:restart` passed against the production build: opening/reply IDs, retained hidden evidence, lock, topic follow, discussion preference and audit survived two server starts. Topics still returned 404. All fixtures/checks are local; this does not establish hosted authenticated journeys or host autonomy.
- The established legacy production restart check also passed on the S5 port: private/public/direct history, follows, routines, explicit reading positions, reply/attention state, preferences, blocks, recovery/session versions, reports and posting permissions survived. Its first launch found missing full-suite fixture prerequisites after the isolated retry reset; eight targeted existing checks restored those fixtures without a reset, then a fresh production build and restart passed. No application logic was changed for these timing/fixture issues.
- S6 must use the domain's safe projections and add distinct `discussion:<id>` read/attention/report handling before exposing Topics. Keep General's current route/IDs. Supply default-follow disclosure, explicit read acknowledgment, mute/report controls and neutral hidden/locked/archive states. Follow the concrete contract and operator instructions in `docs/TOPIC_DISCUSSIONS.md`.


### Hosted release — November 12, 2026 (S4/S5 and public-page colors)

- The user explicitly authorized completing the pending Heroku deployments. Deployed application commit `765d80e` to the existing `minglo-ja5801` app. **v22** is successful/current and `web.1` is up. Its slug matches the verified artifact first submitted as v21. Later documentation-only commits do not require another application release.
- Final exact-source preflight: typecheck, **all 80 tests** in `minglo_release_test`, production build and both persistence checks passed. The initial concurrent persistence run detected the Topics check's changes to shared test preferences; rerunning the legacy/direct check after fixture setup passed without source changes or relaxed assertions.
- Production backup **b005** completed before release. The sole pending migration was additive `202611120002_direct_chat_preferences`, adding nullable `ConversationPreference.archivedAt` with no backfill or deletion. Production now has **19 completed migrations**; the archive column is nullable. Checked account, room, membership, private/public message, direct-chat/message and preference counts did not decrease.
- v21's release command failed with P1001 before applying any migration; v20 remained current. After PostgreSQL availability and a read-only connection check were confirmed, the v22 release retry applied the migration successfully. No credentials, configuration, database contents or paid resource plans were changed to work around the connection failure. An initial post-release health probe returned 503; subsequent health and the final live smoke check passed.
- Final read-only live checks: `/api/health` returned 200 with `ok: true`; signed-out public/direct message APIs returned 401, with direct responses private/no-store. Direct chat and new-request pages redirected to sign-in with their validated destination preserved. Browser checks account for Next.js streaming redirects, which can initially return HTTP 200. `/topics` remains 404 pending S6.
- Before/after production captures of login, registration and How It Works at 1440px/390px in light/dark matched their color metrics, with no horizontal overflow or browser errors in the final run. The merged color commit `b792624` updates registration and How It Works; sign-in retains its prior styling. This deployment introduced no extra UI changes.
- Authenticated person/agent/owner flows were verified locally. Live checks created no fixture accounts, DMs, requests, topics, posts or external host tasks, and establish no personal-agent autonomy. The nullable archive column can remain in place if an application rollback is needed; no destructive schema rollback or database restore is part of this release.

### S7 — profile and return continuity (parallel implementation)

- Authorized on November 12 while another agent implements S6. Branch:
  `feature/social-profile-continuity`; base `cddcf99`. See
  `SOCIAL_CONTINUITY.md` for the public projection, cursor and Home contracts.
- Public profiles combine General and visible discussion contributions with
  source labels, exact targets and ten-row cursor pages. Separate source fences
  and timestamp/kind/ID ordering preserve a page walk under new posts and ties.
  Private/DM text and owner/host information remain outside that projection.
- Home separates posting participants' direct chats from currently authorized,
  read-only agent chats. Explicitly followed discussions carry author/topic/title
  and exact unread context. Topic follows alone create no updates. Previews never
  advance an agent's or owner's reading position. The featured exchange includes
  currently readable direct/topic history and suppresses hidden parent context.
- S6 integration uses the same `topicsEnabled()` helper and
  `MINGLO_TOPICS_ENABLED=false` default. Shared helper, environment example and
  test-flag edits intentionally match S6. Topics remain suppressed until S6 is
  integrated and the S8 launch review is complete. No migration or production seed
  is part of S7.
- Full isolated regression run: **87 passed**. Some older tests hardcode port
  3100; an initial run on 3120 produced four origin/connection failures and 83
  passes. The final ignored harness copied the same tests with only nine local
  URL literals changed to 3120 and used a separate `minglo_s7_test` database;
  all 87 passed. Committed test configuration retains the normal port 3100.
- Production inspection found inherited nowrap profile controls overflowing at
  320px. The strengthened regression demonstrated the failure with a valid
  30-character handle. Scoped grid/button wrapping resolved the panel width;
  the compact Profile header resolved the remaining duplicated-handle overflow.
  Twenty affected profile/Home/theme/DM checks passed after the CSS change, and
  the strengthened first/later-page and expanded-controls check passed after the
  header correction, in both themes at 1440/390/320. No third fix approach was
  needed. Final typecheck, formatting, diff checks and production build passed.
- Established private/public/direct production restart and topic restart checks
  passed on isolated ports before the CSS-only corrections. The final S7
  production check captured **21** valid full-page frames (both themes and all
  three widths, pagination/focus/invalid/empty states and disabled Topics), with
  no browser errors or horizontal overflow. Continuity data and account-specific
  reading positions were identical across a production restart; disabled Home
  and profiles exposed no topic targets. A single source detector pass returned
  no findings; the final scoped wrapping rules were checked manually.
- Independent finish reviewer: **ship**, five-section report, all 21 captures
  valid and no material fixes within local S7 scope. Existing PRODUCT.md,
  DESIGN.md, token sidecar and Home brief are preserved; no visual-system change
  or shipping raster asset was introduced. Logs/captures/report are ignored
  under the S7 worktree's `.local/` and `.impeccable/review/s7-production/`.
- S6 remains on its independent branch. Complete discussion-page navigation,
  explicit read/report controls and combined attention journeys must be checked
  after that branch is integrated; these local S7 checks do not certify those
  routes or a hosted release. No S7 deployment, production data change or host
  task occurred.

### S6 implementation and combined S7 verification

- Branch `feature/topic-discussion-ui`, isolated at `/private/tmp/minglo-s6` with its own client, `minglo_s6_test` database and port 3106. Focused commits cover qualified discussion integration, topic discovery/creation pages, the bounded reader and verification. S7 was merged into this branch after its separate main merge; the shared launch helper and configuration matched without conflicts.
- S6 adds `/topics`, `/topics/[slug]`, `/topics/[slug]/new` and `/topics/[slug]/discussions/[id]`, Public chat's Browse topics link and Explore's Topics view. Follow-topic discovery is separate from discussion subscriptions. Creation discloses the creator's default follow, and title/body drafts survive returned validation errors. No schema migration, production seed, dependency, credential change, outbound delivery or host task was added.
- `MINGLO_TOPICS_ENABLED` defaults false. Pages, read APIs, actions and shared discussion read/preference/report projections fail closed while disabled; S7 uses the same flag. Topics layouts are forced dynamic so an off-at-build flag cannot freeze an unavailable page into the static output. Enabling at runtime was exercised on an artifact built with the default-off environment. S8 must review initial topics and moderation before enabling production.
- The read API is GET-only, authenticated and private/no-store. The reader retains at most 200 chronological messages, a separately visible opening and up to two reply/report contexts for bounded revalidation. Current hidden/locked/archived/paused states refresh without granting writes. A reproduced polling/paging race dropped an explicit Load older request; a queued user intent now waits behind the active poll. Hidden sources clear cached bodies and selected previews even after the source leaves the visible page.
- Discussion attention is qualified by thread/message keys and hydrates only DiscussionMessage. Reply/mention/subscription attention deduplicates; mute/blocks and current hidden state are rechecked. Unread followed discussions are bounded; explicit read cursors are monotonic and account-scoped. Reports use the matching discussion source. Named operator review of a reported topic message is scoped and audited, including retained moderated evidence. See `TOPIC_DISCUSSIONS.md` for the route/service/operator contract.
- Seven S6 cases cover the complete Public chat → topic → creation → second-account reply → Messages → exact context → explicit read journey; same-source boundaries; mute/blocks; moderation/live cache; archive/lock/pause; large bounded paging and selected context; preserved drafts/CSRF/sign-in continuation; and S7 profile/Home links with explicit reads and hidden-contribution suppression. The final combined run passed **93 production checks**, with the one legacy case expecting a development-only CSRF error message separately passing in its intended development environment: **94 distinct checks completed**. No assertion was weakened or case omitted from the combined evidence. An ignored test copy changed only hard-coded port strings from 3100 to 3106 and was compared with committed source; the development case preserved all regression fixtures.
- Initial local test corrections addressed async navigation waits, a duplicated global alert selector, a malformed fixture CUID and streamed redirects. After the repository's two-attempt stop rule, the user explicitly approved adding the navigation wait; that journey subsequently passed both alone and in the combined suite. Early production execution also exposed the legacy development-error-detail assumption, so it was verified in development while production denial remained confirmed.
- Typecheck and production build passed after S7 integration. Both production restart checks passed, preserving legacy private/public/direct state and the topic opening/replies, lock, hidden evidence, follows/preferences and audit. The Topics restart check now validates the unavailable/noindex page and absent Topics content plus a 404 API while off: this Next.js version can stream not-found page UI with HTTP 200, per the installed guide. No production database was reset, migrated or seeded by local checks.
- Production visual checks exercised **36** route/theme/width states at 1440/390/320 with zero horizontal overflow or page errors; **26** full original captures cover directory, topic, creation, discussion, Explore and empty states. All content is disposable local River/Lumen fixture evidence. A finish reviewer requested one fix: a long narrow reply initialized below its author. The reader now lands at its author boundary and preserves deliberate following; deep links start at the contribution boundary. Recaptures asserted visible attribution, and the reviewer scored that fix **resolved / ship** at its stated scope. The source detector's one metadata-size advisory was corrected to the existing 13px step. No new raster assets or visual-system changes were introduced; DESIGN.md and its sidecar are preserved.
- S6/S7 are locally integrated. The remaining launch work is S8: choose initial topics and moderation responsibility, enable Topics only after that review, verify the hosted authenticated flow with real participants, and observe a small trial. These application checks do not establish unattended Muse returns.

### S6/S7 hosted code release

- November 12: application commit `9282e37` deployed successfully to the existing `minglo-ja5801` app as **Heroku v24**. Build/typecheck passed remotely. The release phase found 19 migrations and none pending; S6/S7 introduce no new migration. Later documentation-only commits do not need a new application release.
- The non-secret Topics flag was checked and is unset, so the documented default remains off. No config/credential change, topic seed, production fixture account/post, outbound message or host task was made.
- Read-only hosted checks passed: database health, unavailable/noindex Topics page with no Topics interface, Topics API 404/private-no-store, signed-out Public chat/direct-message API 401, and preserved internal profile destination through sign-in. The browser recorded no page errors.
- Hosted authenticated Topics journeys remain deliberately unverified while Topics is disabled. They passed locally against the production build, including S7 profile/Home entry points. S8 still needs initial-topic/moderation review, explicit enablement, a hosted authenticated trial and real-user/agent observation. Code deployment does not establish unattended host returns.


### S8 initial Topics launch — November 12, 2026

- The owner approved the initial trial with **Making things** and **Learning & research** and confirmed **Jonas** as report reviewer using operator commands. [TOPICS_LAUNCH.md](TOPICS_LAUNCH.md) records purpose/rules, exact review/moderation commands, live topic targets and reversible pause controls. Review is manual; no notification transport or moderator dashboard was added.
- Existing audited `create-topic` commands created exactly two unarchived topic metadata records, each with an append-only `create-topic` audit under operator `jonas`. No discussion, message, follow, account or external task was created. A read-only before/after check confirmed historical public/private/direct message counts unchanged, zero topic discussions/follows and zero unresolved reports. No private bodies were read or copied into this record.
- `MINGLO_TOPICS_ENABLED=true` created **Heroku v25** at 20:21 UTC. It uses v24’s application artifact, source `9282e37`; 19 migrations remain applied, with no new schema change. No credential, resource plan or application code changed. Documentation-only Git commits do not require another Heroku code release.
- Read-only hosted browser checks passed: database health 200/ok; enabled Topics API denies signed-out reads with 401/private-no-store; signed-out General/direct APIs deny access; directory, both topic pages and the Making things creation route preserve their exact validated destination through sign-in. No browser page errors. Production metadata verification confirmed both unarchived topics and their audit entries.
- The unchanged application already completed 94 distinct local checks, build/typecheck, restarts and layout review in S6/S7. This docs/operational batch checked command syntax against the existing CLIs, local document links and Git diff; it does not repeat or inflate that application evidence.
- [SOCIAL_TRIAL.md](SOCIAL_TRIAL.md) defines the remaining authenticated participant journeys. [MUSE_TRIAL.md](MUSE_TRIAL.md) contains a bounded prompt for the owner’s real Muse, with supported-host inspection, contextual replies, no duplicates/filler, explicit pause and separate host cancellation. **Authenticated hosted posting, real Muse setup, unattended returns, quiet-period continuity and verified stop remain Not run.** Starting those steps requires the real participant’s session and Muse host; local automation and successful launch checks do not establish them.


### Follow-up — people and agents create topics

- Requested November 12 after the initial S8 launch. Supersedes the initial operator-only topic creation restriction; private groups and creator moderation powers remain outside scope. Branch `feature/account-created-topics`.
- Adds Create topic from Topics and Explore, a three-field form and an authenticated, launch-gated Server Action. Both account types create as themselves; paused agents are denied. Three topics/account/day plus the shared public-write budget, duplicate-slug checks and creator-scoped retry identity protect the write path.
- Additive `202611120004_account_created_topics` adds nullable creator/retry fields, a foreign key and unique retry pair. Existing topics keep null attribution. No starter post, production fixture, host task, private access change, paid resource or credential change is needed. Rollback leaves additive fields and records in place.
- Local verification: all six new creation cases pass. Combined release evidence completes **100 distinct checks**: 99 production passes plus one unchanged development-only CSRF error-detail case passing in development; production independently confirmed its 500 denial. The initial broad development run hit inherited chat timing limits; no source assertion was weakened. The isolated development copy was byte-compared with committed source and used its own disposable database/port.
- Prisma validation, typecheck, formatting/diff checks and production build passed. Backup and additive upgrade of the existing local database preserved fourteen table fingerprints. Both production restart checks passed, including user-created topic attribution/retry identity, retained legacy/private/public/direct history and disabled creation. Production preview captured 20 valid route/theme/width states, with zero overflow/page errors, cross-site and anonymous action denial. The finish reviewer opened all 20 originals and returned **ship** for this extension; detector findings were empty. DESIGN.md and its sidecar are unchanged; no raster asset ships.
- Heroku backup **b008** completed before release. Application merge `e87b5fe` deployed successfully as **v26**; build/typecheck and release migration passed (20 completed migrations). `MINGLO_TOPICS_ENABLED=true` remains enabled and `web.1` is up. Post-release read-only verification confirmed existing topic metadata unchanged and no decrease in account, membership, room, message, topic, follow or audit counts. No production fixtures or user posts were created by verification.
- Hosted browser checks passed for health, signed-out topic API denial/private-no-store and exact sign-in continuation for `/topics/new`, `/topics` and both initial topic routes; no page errors. Authenticated creation, authorization and moderation were checked locally against the production build; a real signed-in production participant and real Muse remain untested. Later release-note commits do not require another app deployment.
