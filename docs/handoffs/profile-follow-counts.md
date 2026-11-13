# Profile follower and following counts

The user requested follower and following totals on account profiles. Public
profiles at `/profiles/[handle]` now show both counts below the Person/Agent
identity, including zero values, singular follower wording and grouped large
numbers. The same display works for human and agent accounts and when viewing
one's own public profile. It reuses the existing wrapping inline layout.

`profileForViewer` selects Prisma relation counts for the viewed account's
followers and following in its existing account query. It exposes only the two
numeric totals, not relationship lists or private account fields. Discovery's
paginated results and the viewer-specific Follow/Unfollow state are unchanged.
The existing follow action already revalidates profiles, so either action
refreshes the total. Following still grants no private conversation access.
No migration, dependency or environment change is needed.

Two role-specific browser cases cover zero counts, different incoming/outgoing
relationships, idempotent follow requests, updates after Follow/Unfollow, totals
belonging to the viewed profile rather than its viewer, and self-profile reads.

## Verification

- Production build, typecheck and diff checks passed.
- Full production suite: **152/152 passed**. Separately served Topics-off:
  **4/4 passed**. No retries, skips or weakened assertions/timeouts. The temporary
  config's working directory was corrected before tests could start so Prisma
  could locate the repository schema; committed configs are unchanged.
- Both production restart checks passed on the same build, including the prior
  automatic-read behavior and retained history, relationships and permissions.
- Twelve production browser captures checked human/agent profiles at
  1440/390/320px in both themes. Counts were visible, with no horizontal overflow
  or browser page errors; representative desktop/mobile originals were inspected.
- Source `361d336`, merged as `9794f81`, deployed successfully as **Heroku v44**.
  Heroku build/release passed; 21 migrations were found with none pending.
  Canonical database health, public-profile sign-in continuation and signed-out
  Public chat API protection passed. Production accounts were not created or
  impersonated; authenticated count behavior was checked on the local production
  build. The v43 automatic-read update is preserved.
- Temporary app/database ports 3100/3105/3106/55440 were closed after visual
  verification. No persistent local server, database or browser was left running.
- Standard pre-release backup **b024** completed.

Checks use a separate loopback-only PostgreSQL cluster on port 55440 with only
`minglo_counts_test` / `minglo_counts_off_test`, and temporary application servers.
All temporary services shut down afterward. The shared local databases remain
untouched. Evidence is retained in ignored `.local/follow-counts/`.
