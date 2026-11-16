# Build 2 local API and analytics demo

This is an explicitly approved, disposable localhost verification mode. It does
not alter Heroku. Ordinary usage analytics remains opt-in; ordinary app replay
stays disabled. A separate recording choice is required on each demo visit.

## Set up

Use Node 22, `npm ci`, and the isolated database from `npm run db:local` (or an
existing loopback PostgreSQL). Create a separate database named
`minglo_build2_demo_test`; never copy production data into it. The `_test` suffix
and loopback database host are enforced for this mode.

Copy `.env.example` into ignored `.env.build2.local`, then set these values:

```dotenv
DATABASE_URL=postgresql://minglo@127.0.0.1:55432/minglo_build2_demo_test?schema=public
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
# Generate a new random AUTH_SECRET, at least 32 characters. Never commit it.
MINGLO_LOCAL_DEMO_ENABLED=true
POSTHOG_ENABLED=true
POSTHOG_TRANSPORT=cloud-local
POSTHOG_ENVIRONMENT=verification
POSTHOG_HOST=https://us.i.posthog.com
# Set POSTHOG_PROJECT_TOKEN to project 739580's public ingestion token.
```

Load that trusted local file in your shell (`set -a; source .env.build2.local;
set +a`), run `npm run db:migrate`, then `npm run build` and
`npm run start -- --hostname 127.0.0.1 --port 3000`. Next start supplies
`NODE_ENV=production`. No `DYNO` may be present. Never use a personal PostHog key.
The named `cloud` production mode retains its original Heroku-only guards.

## Complete the real action

1. Register/sign into a disposable person account. Open
   `http://localhost:3000/demo/github-profile`.
2. If measuring this run, explicitly enable Usage analytics below the editor and
   save, then reload the demo page. Before that choice, there must be no PostHog requests.
3. Open **Import from GitHub**, enter a public username and choose **Preview
   GitHub profile**. Minglo makes one unauthenticated server-side
   `GET https://api.github.com/users/{username}` request. There is no model key,
   paid API or GitHub login. Requests have a five-second timeout and bounded
   response size; each Minglo account gets ten lookups per fifteen minutes.
4. Review the returned public name/bio, choose **Use in my draft**, review again,
   and choose **Save profile**. Lookup/application never save implicitly. An empty
   GitHub bio preserves the current introduction. This does not verify GitHub
   ownership or connect accounts. Only the signed-in Minglo profile is saved.
5. Reload and confirm the saved name/bio. Capture the preview and successful save
   as evidence. Label any synthetic account and automated browser honestly.

GitHub receives the entered username and the server's connection address. Minglo
discards other GitHub response fields. Neither the username nor profile text is
sent in usage analytics. The two explicit click categories are
`github_profile_lookup` and `github_profile_apply`; no DOM text/URLs are captured.

## Optional bounded replay

PostHog project-side replay must permit the two approved URLs: the canonical
Product Page and this exact localhost demo (including 127.0.0.1 if used). Keep
other/private URLs excluded, masking on, autocapture/web-vitals off, network and
console recording off, and the free/no-card configuration unchanged.

After ordinary analytics consent, a tester may separately choose **Allow this
demo recording**. Consent is not remembered across pages. The local recording
expires with its eligibility lease within one minute; the public-page version
has a ten-minute maximum. Leaving, switching tabs, withdrawal and server
ineligibility stop collection. Already sent/in-flight data cannot be recalled.
The recorder has its own opaque identity and cannot initialize on private URLs.
All text/inputs/attributes are masked; images, scripts, hidden fields and embeds
are blocked. This intentionally reduces replay fidelity. No chat, claim,
recovery or settings screen may be recorded.

Only say a replay is verified after the actual project displays it. HTTP 200
proves transport acceptance, not dashboard visibility. A controlled automated
recording verifies the integration; it does not establish a consenting human
usability trial. Keep those evidence types separate.

## Inspect and shut down

In PostHog project 739580's Events tab, filter `environment=verification`:
`page_viewed` has a coarse `page_name`, and `ui_action_clicked` has one of the two
fixed action categories. `profile_updated` follows an actual changed save. Expect
opaque identity, account type, schema version 1, browser/server source and
`$geoip_disable=true`; no names, handles, GitHub usernames/bios, raw app URLs or
conversation data. Separate replay sessions use `surface=local_demo` or
`surface=product_page`; they are not production adoption metrics.

Turn the account analytics choice off, stop the Next server, and stop only the
isolated PostgreSQL cluster started for the demo. Keep local services off when
idle. Do not push to Heroku as part of this task.
