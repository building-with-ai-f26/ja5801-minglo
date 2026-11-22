# Google sign in and email recovery handoff

Date: November 21, 2026. Implementation approved by Jonas: “just go ahead and
build.” Scope: Google and email recovery for human accounts, existing-account
linking and user notices. Apple remains deferred. No deployment, public activation,
paid resource or user announcement is part of this implementation run.

## Implementation

Base checkout: `7cb737a`. Implementation stays in the existing checkout. Jonas
subsequently authorized publishing this handoff so Muse can read it. The
`docs/account-signin-handoff` branch publishes only this document and its linked
behavior guide; application changes remain local and are not deployed. Full
behavior and operational gates:
[Account sign in](../ACCOUNT_SIGNIN.md).

- Additive migration `202611210001_account_signin` retains existing accounts and
  permits explicitly created Google-only human accounts without a local password.
- Google callback validates OIDC and app trial membership, resolves immutable
  provider identity and preserves existing JWT session-version enforcement.
- Existing users connect from Settings after recent authentication; unfamiliar
  Google identities offer connecting an existing account before explicit signup.
- Verified recovery emails, single-use resets, password setting/changing,
  disconnection safeguards and backup codes support human accounts; agents retain
  their separate password/code flow.
- Existing-human notice is public-mode only, launch-date scoped, dismissible for
  seven days, limited to one reminder and removed after actual setup completion.
- Privacy/help/configuration documentation and support address are aligned.
  No legal terms were created. Official Google button images are unmodified,
  with attribution in `public/images/auth/README.md`.
- No new package or paid resource. Resend uses the fixed HTTP API. Local tests use
  a disposable OIDC provider and locally captured email, with guards against
  production/remote execution.

## Verification

Passed locally against disposable databases on the isolated PostgreSQL port 55439:

- Production build and TypeScript checks.
- Existing browser suite: 162 passed with auth rollout disabled.
- New authentication suite: 14 passed, including account continuity, explicit
  linking, single-use recovery, session invalidation, OAuth rejection cases,
  delivery failure, notice behavior and reauthentication after an idle Settings
  page outlives the ten-minute window.
- Trial allowlist and local-fixture guards: 2 passed.
- Topics-off compatibility: 4 passed. Total: 182 distinct browser tests.
- Final-build owner/agent guide checks: 2 passed (repeated from the existing suite).
- Additive upgrade from the base schema retained account ID, password hash,
  session version and existing message; no identity or email backfill occurred.
- Both production restart checks passed: existing chat/request history, account
  state, permissions and preferences persisted; topic identities, hidden evidence,
  locks, follows and moderation audit persisted with feature gating intact.
- Mobile/desktop visual review at 390/1440 pixels in light/dark themes; auth
  layouts also checked for horizontal overflow at 320 pixels.

The full compatibility and Topics-off runs preceded only the final guide copy
and new-feature stale-auth error refresh; those changes passed their targeted
checks on the final build. Evidence is kept in ignored `.local/auth-release/`;
test emails are under ignored `.local/auth-mail/`. No live Google login or real
mail delivery is claimed. Local email is captured, and OAuth uses the guarded
local OIDC fixture.

During verification, the OIDC fixture initially omitted a userinfo discovery
endpoint required by the installed Auth.js implementation. Adding that endpoint
fixed the fixture on its first correction. Two new test selectors were narrowed
because Next's route announcer and the pending-email status also matched generic
role selectors. Both corrected assertions passed. A real signed-in OAuth
cancellation regression was demonstrated, then fixed: users now return to
Settings with an explanation rather than silently landing on Home. No issue
reached two failed fixes.

## Remaining work before any activation

### Muse coordination

The GitHub handoff branch is documentation only. Muse can read it directly in
GitHub without checking out or merging application code. Target Heroku app:
`minglo-ja5801`; canonical app origin: `https://www.minglo.club`.

The immediate task is to prepare the existing Google Web client secret and a
replacement sending-only Resend key restricted to `accounts.minglo.club`, using
secure credential storage. The target variable names are `AUTH_GOOGLE_SECRET`
and `RESEND_API_KEY`. Never paste the values into chat or a GitHub document.

Report readiness and any account-access blocker to Jonas without secret values.
Codex handles the application release and migration. Heroku configuration changes
restart the app, so wait for explicit deployment approval and Codex's release
coordination before installing config or revoking any credential that could be
in use. This documentation push does not authorize production changes. No live
trial or public rollout has happened yet.

### Trial configuration

Cortana's service handoff reports Google and Resend provisioning/DNS complete.
It does not establish app integration or email delivery. The Google project is
`minglo-515417`, with the existing production callback
`https://www.minglo.club/api/auth/callback/google`.

Secure configuration still needs the Google client secret and a replacement for
the Resend key that was pasted into chat. This implementation did not use or save
the pasted key, change Heroku config, send email, rotate credentials or contact
users. Credential values must not be added to this document or command output.

After explicit deployment approval and a backup, install the migration and
configure an initial trial:

- `MINGLO_AUTH_ROLLOUT=trial`
- `MINGLO_AUTH_TRIAL_EMAILS=jonas.altaher@gmail.com,ja5801@stern.nyu.edu`
- `AUTH_GOOGLE_ID=589601645727-hi48e0b5u54ei35cdmbh7mb67fc419g1.apps.googleusercontent.com`
- `AUTH_GOOGLE_SECRET` from the project's Web client, securely installed
- `MINGLO_EMAIL_TRANSPORT=resend`
- `RESEND_API_KEY` replacement, sending-only and restricted to accounts.minglo.club
- Keep `MINGLO_GOOGLE_SIGNUP_ENABLED=false` initially while checking existing
  account linking; enable for an explicitly designated new-account trial later.
- Keep `MINGLO_AUTH_NOTICE_LAUNCHED_AT` unset during the trial.
- Do not configure `MINGLO_GOOGLE_TEST_ISSUER` or local mail transport on Heroku.

Sender is `Minglo <no-reply@accounts.minglo.club>`; reply-to/support is
`jonas.altaher@gmail.com`. Preserve all existing website DNS and mail records.
Google Testing alone does not restrict basic identity scopes; the app allowlist
must remain on. Verify real Google login/linking, account continuity, delivery,
spam placement and aligned DKIM/DMARC before proposing public activation.

Public release and announcements remain a later approved action. The missing
terms page remains a separate decision, not an invented legal document. Do not
roll back to code that assumes every account has a password once Google-only
accounts exist. Preserve provider login for existing users when disabling new
registrations or announcements.
