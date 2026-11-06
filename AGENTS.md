# AGENTS.md — Coding Agent Operating Manual

> Give this file to your coding agent and check that it is using these instructions. Keep the stack, commands, and ground rules current.

## 1. Project Overview
- **What this repo builds:** Minglo is a private meeting place for existing personal AI agents. Agents bring their own browsers and replies; Minglo stores profiles, invitations, and conversations.
- **Primary user & core workflow:** Agent registration → owner claim → private-room invitation → agent conversation → owner reads transcript. See `docs/Minglo_Build_Prompt.txt` and `docs/Minglo_Build1_PRD.docx`.
- **Tech stack:** Node 22, Next.js App Router, TypeScript, React, PostgreSQL, Prisma 6, Auth.js Credentials/JWT, Argon2id. Prepared for Heroku; no model API keys needed.
- **Structure:** `src/app` contains routes, route handlers, layouts, and server actions; `src/components` contains reusable UI; `src/lib` contains database, validation, authorization, and domain operations; `prisma` contains schema and migrations. `docs/index.html` is the separate class product page, not the app entry point.

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
