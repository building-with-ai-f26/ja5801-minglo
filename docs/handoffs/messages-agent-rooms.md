# Agent-room conversations in Messages

## Approved correction

An owner could open an existing agent-room transcript through its URL, but Messages showed an empty “Your agents’ chats” group because it queried only direct conversations. Jonas explicitly requested that the actual conversations appear in this group. The correction lists existing agent rooms beside direct chats rather than moving history or creating duplicate conversations.

## Read model and permissions

`listMessageChats` supplies the current Chats view. It combines bounded ID/timestamp prefixes from direct conversations and authorized agent rooms, sorts them by activity with stable ID/source ties, then selects one shared 30-item page. Only the selected rows' latest message previews are loaded. The existing maximum page is retained; histories are not loaded to build a list. Direct request counts and Requests/archive workflows retain their existing helper and semantics; rooms gain no archive operation or invitation bypass.

Room candidates use the existing creator/accepted-member/current-connected-owner rules. Before loading private previews, the service locks selected Room rows and then all relevant Agent rows in order, matching existing Room→Agent writers. It revalidates the selected owner connection and the shared `readableRooms` predicate after locking. Removal, leaving, disconnection, current-owner changes and independent creator access therefore retain their existing meaning. Lists never acknowledge an owner's or agent's reading position.

Cards retain original transcript URLs and name their source and participation rights. Connected-owner observations appear in “Your agents’ chats” as read only. Accepted agents see their rooms in their own chats; a human room creator retains independent read-only access. Already-read, muted and closed rooms remain discoverable. A current agent filter intersects the same existing authorization. The established Side by Side cards, typography, themes and responsive wrapping are reused; no CSS tokens or assets were added.

## Isolation and Git tracking

Concurrent theme edits in the shared checkout were preserved. Implementation and checks use `/private/tmp/minglo-follow-ups-20261112`, branch `fix/messages-agent-rooms`, initially based on GitHub main `811eb47`. The bounded read model, Messages UI and regression coverage are separate focused commits. No duplicate worker was launched. No schema, dependency, credential, DNS or resource change is needed.

## Verification in progress

The new browser regression failed against the previous production artifact because the room card was absent. The first runtime correction passed all **19 focused cases**, including the four new room visibility/access/pagination cases and the existing structure cases. One new test initially imported `closeRoom` from the wrong module; the import was corrected, and build/typecheck passed. No application correction has failed or reached the two-failed-fixes threshold.

New coverage verifies the actual Cortana/Lyra-shaped journey using synthetic local fixtures, retained history after a claim, accepted versus invited membership, read/mute behavior, owner posting denial, mixed-source pagination without duplicates, direct archives/requests, closed history, selected-agent checks and concurrent removal/disconnection with surviving creator access. The owner clicks the Messages room card and reads the original transcript without an agent composer. Desktop and 320px light/dark originals were inspected. Full-suite, separate Topics-off, restart and hosted results will be appended after completion. Evidence is ignored under `.local/messages-agent-rooms/` in the isolated checkout.

## Final local checks
+
+The complete production run passed **124/124**, and the separately served Topics-off run passed **2/2**: 126 distinct passing cases, with the focused 19 a subset. Final typecheck/build and both production restart checks passed. Four populated Messages originals cover desktop/320px and light/dark; the room and direct cards share their existing responsive styles and correct transcript links. All five changed app/test files are frozen in a source manifest. No runtime correction failed, assertion was weakened or new authority was granted.
+
+Heroku queued fresh backup requests (including this release's b014); they are not reported as completed. The latest completed backup is b012 from earlier this evening, before this release. The app update changes read/list behavior only, with no schema migration or data mutation, so release proceeds with that existing completed backup while the queued capture remains pending. The unrelated shared-checkout theme edits are excluded and preserved.

## Hosted release complete

The fix branch was merged into GitHub main as **`99cca62`**, pushed and deployed successfully as **Heroku v33**. An isolated integration branch preserved the active theme edits and local main in the shared checkout. All five verified app/test hashes matched the merge. Remote build/typecheck passed; release output found 20 migrations with none pending, and web.1 is up. Capture b014 subsequently completed; its earlier queued state above was recorded at the time, with the prior completed b012 already available.

Read-only live health, sign-in-continuation, access-denial and theme checks passed with no page errors. A separate metadata-only check confirmed that the original reported room, accepted memberships and current owner connection remained intact; no conversation contents were fetched for that audit. Authenticated card discovery and owner read-only transcript access were verified using local synthetic fixtures, not production impersonation or new production accounts. No messages, read positions, memberships, owner claims, host tasks or production settings were changed by this fix.

The original conversation now belongs in Messages' current Chats list under its existing current-owner rules, including the selected-agent view. A normal page refresh picks up the new list. Runtime test processes are stopped, and there is no remaining Messages-fix implementation, merge or deployment task. Final release-documentation commits do not require another application deployment. Separate theme work in the shared checkout remains its own session's scope.
