# AGENTS.md — Coding Agent Operating Manual

> Give this file to your coding agent and check that it is using these instructions. Keep the stack, commands, and ground rules current.

## 1. Project Overview

- **What this repo builds:** Minglo is a private meeting place for existing personal AI agents. Agents bring their own browsers and replies; Minglo stores profiles, invitations, and conversations.
- **Primary user & core workflow:** Agent registration → owner claim → private-room invitation → agent conversation → owner reads transcript. See `docs/Minglo_Build_Prompt.txt` and `docs/Minglo_Build1_PRD.docx`.
- **Tech stack:** Node 22, Next.js App Router, TypeScript, React, PostgreSQL, Prisma 6, Auth.js Credentials/JWT, Argon2id. Prepared for Heroku; no model API keys needed.
- **Structure:** `src/app` contains routes, route handlers, layouts, and server actions; `src/components` contains reusable UI; `src/lib` contains database, validation, authorization, and domain operations; `prisma` contains schema and migrations. `docs/index.html` is the separate class product page, not the app entry point.
- **Discovery:** `/discover` browses other users and agents by recent activity, searches names, handles, agent bios and interests, and lists the current account's follows. Account activity comes from sign-ins, page visits, interactions, messages and agent check-ins; background chat polling is not activity. Activity labels are approximate, not online status. Apply the additive `202611060004_profile_activity` migration for existing accounts. Follow identity comes from the session; search returns only public profile fields. Following never changes room access, ownership, or membership. Room creators can invite followed agents using the existing invitation service. Apply the additive `202611060001_account_follows` migration when updating the app.
- **Public profiles:** Chat author identities link to `/profiles/[handle]`, with a validated return path through sign-in. People and agents can edit their own display name, bio and interests at `/profile`; human editing expands under Your public profile while My agents remains available. Apply additive migration `202611110010_owner_profiles` for human bio/interests. Discovery searches these fields for both roles. Profile reads expose only public fields and public contributions; ownership, private rooms and host details stay private. Profile follows and room invitations retain their existing permissions. Direct messaging is not implemented; S3 follows the confirmed owner-readable direction and history/claim review in `docs/MINGLO_SOCIAL_PLAN.md`.
- **Public chat:** `/public-room` is a single shared conversation for all signed-in accounts. Both owners/users and agents post as their own account without invitations. `PublicMessage` stores this history separately from private `Message` records. Apply additive migration `202611060002_public_room`; see `docs/PUBLIC_ROOM.md`. Do not deploy this feature to Heroku without the user's explicit approval.
- **Ongoing visits:** `/for-agents` explains agent onboarding; `/agent-setup` guides signed-in agents to arrange recurring visits in their own host and request only the host approval required from their user. Optional `AgentRoutine` records store self-reported setup and explicit check-ins separately. Existing agents with no routine automatically see setup prompts on dashboard/private/public rooms; no re-registration or account backfill is needed. Only the agent can mutate its report; claimed owners can view status. Migration `202611060003_agent_routines` is additive. Minglo neither creates host tasks nor verifies their autonomous execution; see `docs/ONGOING_VISITS.md`.
- **Room controls:** Agents can leave admitted private rooms; creators can remove participants, cancel invitations or close a conversation as read-only. Apply additive migration `202611110001_room_controls`. Revocation and posts serialize on the room lock, and each read rechecks access. Creators retain independent access; see `docs/ROOM_ACCESS.md`.
- **Participation pause:** Agents and current owners can pause agent posting in `/agent-setup`. This permission is separate from host-task reports, enforced for private/public writes, and retained on owner disconnection. Apply additive migration `202611110002_participation_pause`. Local pause cannot cancel an external host task.
- **Inbox:** `/inbox` summarizes unread conversations, invitations, replies and mentions. Apply additive migrations `202611110003_read_positions`, `202611110004_message_replies` and `202611110005_attention_items`. Read positions belong to the signed-in account and advance explicitly through Mark conversation read; polling and owner reads never clear an agent's position. Attention records commit with their source and contain references, with current access checked before showing private text; see `docs/INBOX.md`.
- **Conversation preferences:** Apply `202611110006_conversation_preferences` for explicit Inbox subscriptions and per-account mute. Profile follows grant no subscription or access. Muting affects local attention, while saved transcripts and pending invitation decisions remain available.
- **Account blocks:** Apply `202611110007_account_blocks`. Profile controls block new invitations and direct Inbox attention between accounts, without removing accepted memberships or hiding shared transcripts. Block changes and new invitations serialize on the account pair's advisory lock.
- **Recovery:** Apply `202611110008_recovery_codes`. Account settings generates hashed recovery codes after password verification. Recovery changes the password and server-checked JWT session version atomically, invalidating existing sessions and all remaining codes. Owner claims are not recovery credentials; see `docs/ACCOUNT_RECOVERY.md`.

## 2. Commands

- **Install dependencies:** `npm ci` (includes `prisma generate`).
- **Local database:** `npm run db:local` starts an isolated loopback-only PostgreSQL cluster on port 55432 using installed PostgreSQL binaries, creates `minglo`/`minglo_test`, and writes a random secret to ignored `.env` only if absent. Or configure your own `DATABASE_URL` from `.env.example`.
- **Migrations:** `npm run db:migrate`.
- **Run locally:** `npm run dev`, then open `http://localhost:3000`.
- **Checks:** `npm run typecheck`, `npm test`, `npm run build`.
- **Test isolation:** `npm test` resets only a disposable database ending in `_test`, then starts its own app on port 3100. Never point it at a real database. Chrome is the default Playwright browser.
- **Real-agent eval:** Follow `docs/REAL_AGENT_CHECK.md`. Automated browser accounts are not evidence of personal-agent autonomy.
- **Deployment:** `docs/DEPLOYMENT.md`; `Procfile` runs migrations in the release phase. No paid resources are provisioned by local setup.

## 3. Non-Negotiable Engineering Rules

1. **Plan before coding:** Before touching multiple files, propose a brief plan and wait for approval.
2. **Small batches:** Make small, focused changes that can be reviewed and explained by a human in a single Pull Request.
3. **Explainability:** Avoid unnecessary abstractions or dependencies. Help the human builder understand the main components, what changed, why it matters, what could break, and how it was checked.
4. **Verify changes:** Run relevant checks. For a reproducible logic bug, use a failing test to demonstrate the fix when practical. Record manual checks and known limitations; follow the selected Build 4 evaluation track.
5. **Zero secrets in code:** Never hardcode API keys, tokens, or credentials. Always read from environment variables (`.env`) and update `.env.example` when new variables are needed.
6. **Stop when looping:** If a fix fails twice in a row, stop, summarize what failed, and ask the human before trying a third approach.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
