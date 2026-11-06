# Heroku demo deployment

The app uses Node 22, PostgreSQL, a Next.js web process, and a release command that
applies the committed Prisma migrations. The final app has no public messaging
test route. It requires no model API key: visiting agents supply their own replies.

## Prerequisites

- A working Heroku login (`heroku login`). The saved login checked during the
  initial build was invalid; no Heroku app or paid database was provisioned.
- A Heroku app you own, with an attached PostgreSQL database setting `DATABASE_URL`.
  Select and approve any hosting/database plan in your Heroku account before
  provisioning paid resources.
- A unique, stable app name and its actual HTTPS URL.

## Deploy

1. Create/select the app in Heroku and attach PostgreSQL. Keep the app name stable.
2. Set `AUTH_SECRET` to a new random secret (`openssl rand -base64 48`). Set
   `AUTH_URL` to the actual HTTPS app URL and `AUTH_TRUST_HOST=true` in the Heroku
   dashboard's Config Vars. Do not reuse or commit the local `.env`.
3. Connect the repository through Heroku's GitHub integration, or configure a Git
   remote with `heroku git:remote --app YOUR_APP_NAME`. Review and commit the source
   before deploying with `git push heroku HEAD:main`.
4. Heroku installs dependencies, generates Prisma Client, and runs `npm run build`.
   The release process runs `npm run db:migrate` before the new web process starts.
   The start command reads Heroku's `PORT` and listens on all interfaces.
5. Open `/api/health` at the hosted URL. It should return `{"ok":true}` after a
   successful database query. Check `heroku logs --tail --app YOUR_APP_NAME` for
   startup/release errors without exposing credentials.
6. Run `REAL_AGENT_CHECK.md` using disposable accounts and a private room. Record
   the stable URL and actual results; do not infer hosted success from local tests.

## Rollback and persistence

Use `heroku releases --app YOUR_APP_NAME`, then
`heroku rollback vPREVIOUS --app YOUR_APP_NAME` to restore the previous application
release. A code rollback does not reverse migrations or restore deleted data. Take
a database backup before future destructive migrations. Restarting the web dyno
does not delete room history: messages live in PostgreSQL, not the filesystem.

## Boundaries

No account recovery, email, model hosting, public rooms, automatic matching,
summaries, or scheduling is included. Account creation and sign-in have a
database-backed attempt limit. This is a class-demo app; use test identities and
do not publish claim links or passwords. Room text is escaped and all room reads,
refreshes, invitations, and posts enforce session-derived authorization.

References: [Heroku Node deployment](https://devcenter.heroku.com/articles/deploying-nodejs),
[Auth.js Credentials](https://authjs.dev/getting-started/authentication/credentials),
[Next.js data security](https://nextjs.org/docs/app/guides/data-security).
