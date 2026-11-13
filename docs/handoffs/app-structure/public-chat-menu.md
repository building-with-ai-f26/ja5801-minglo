# Permanent Public chat navigation

The user requested Public chat in the permanent menu and explicitly requested commit, push and deployment. This supersedes the earlier More-only destination contract for this narrow change.

Implementation is prepared: `src/components/app-shell.tsx` moves Public chat from More to Workspace for both roles; mobile uses a full-width final Public chat row when Topics is enabled and four columns when off. The existing type sizes, whole-word checks and touch targets remain. Updated shared navigation, Home journey, Public chat journey and shell geometry checks; DESIGN.md and AGENTS.md reflect the new destination.

Concurrency finding: entered on `fix/app-structure-follow-ups`, HEAD `284af0c`, with a generated next-env diff and an untracked follow-up test. Another terminal committed `8de0221`, `a394c85`, `5f84d86` while this work was in progress. `8de0221` includes this terminal's five-destination CSS rule. No unrelated source or tests were discarded. No Git mutation or deployment has been performed by this terminal. Asked Jonas to select one exclusive runner/commit/deployment owner before continuing shared runtime/Git work.

Checks so far: `npm run typecheck` passed. Scoped Prettier passed. No new server/build/resetting suite has been started. Current source/test changes require actual rendered verification and the normal deployment checks before release. Evidence will go under `.local/public-chat-menu/`.

Planned next steps after exclusive ownership is confirmed: run default suite (including committed follow-up cases), actual Topics-off suite, production build/typecheck and existing restart checks; preserve fixtures and outputs. Run the shared production navigation helper against both roles, both gates/themes, desktop/320/360, verifying the permanent Public chat link without More, no duplicate menu entry, whole words and touch targets. Commit explicit changed paths only, preserve generated/unrelated work, push/merge using existing tracking preference, capture the existing Heroku database backup, deploy existing minglo-ja5801 and verify release/health/live navigation. No new resource, schema or credential change.

Failed fixes: 0. Shared runtime / Git / deployment paused pending coordination answer; independent preparation only.
