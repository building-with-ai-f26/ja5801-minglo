# Google sign in and email recovery handoff

## Google sign-in error routing — November 25

Heroku **v65** deployed `3a2dbaf6` on November 25, 2026 at 8:57 p.m. ET. Manual
backup **b036** completed before deployment. The release found 27 migrations with
none pending. The code rollback target is **v64** at `880e0ed9`.

Google sign-in failures show an error on the login page, including when a Minglo
session already exists. Users can retry or continue with their existing session.
An active Google connection intent for the same session keeps its error in
Settings. The existing session and Google identity checks apply throughout.

Three local OAuth fixture regressions reproduced the prior Settings redirect for
cancellation, a different linked account and an unconnected account. All three
passed after the fix, including retry with the connected account. The genuine
link cancellation check still passed. Build, typecheck, 19 public auth checks,
two trial checks, 177 app tests and both restart checks passed. The dependency
audit found zero vulnerabilities.

Hosted Chrome checked the login error routes with and without an existing
session, canonical HTTPS, database health and the expected private-room access
of two existing disposable accounts. The actual Google callback scenarios ran
against the local OAuth fixture.

## Public launch complete — November 22

Jonas confirmed **“All set, and the email arrived”** after the fresh Google
sign-in. This confirms the real Google flow, automatic recovery setup and receipt
of the informational account-security email. Raw mail authentication headers were
not independently inspected; no claim is made of a live password-reset mutation
on Jonas's account. Single-use reset/session invalidation was verified locally.

**Heroku v57** successfully activated `MINGLO_AUTH_ROLLOUT=public`,
`MINGLO_GOOGLE_SIGNUP_ENABLED=true` and the existing-user notice cutoff
`2026-11-23T04:05:49Z` (November 22 in New York). Resend remains enabled; existing
credentials were preserved. The previous two-email trial allowlist is inactive
in public mode. No local OAuth fixture is configured.

Public-mode browser checks passed: app/database health, mobile login, real Google
redirect with the canonical callback, recovery form, invalid-link rejection and
public registration with a recovery-email field. Eligible existing human accounts
now receive the in-app setup notice on their next authenticated visit; completed
accounts and agents do not. There was no bulk email announcement, forced account
migration, new paid resource or Apple rollout. Existing passwords keep working.

Application source remains `48f180b660a861d8595815ef96b83df39cd30347` (v56); v57 is
the configuration activation. Code and handoff are published to GitHub. All
requested Google/email launch work is complete; the records below describe the
implementation and checks that led to this state, not remaining approval gates.

## Setup clarity follow-up — November 22

Jonas confirmed that real Google linking worked, then reported that Settings did
not make completion or the remaining email action clear. Read-only checks found
Google connected, no verified recovery email, no pending verification request,
and no recorded account-email errors. That is not evidence of a delivery failure:
the original Google-link flow did not request a verification email.

The follow-up uses the fresh verified Google profile to fill a missing recovery
address after linking or a subsequent Google sign-in. Existing recovery addresses,
pending verification choices and unique-email ownership remain intact. Settings
now leads with the next action or “You're all set,” explains when no email is
needed, distinguishes pending verification from no request in progress, and
collapses completed setup controls. Verification-send failures have a specific
retry/support message; operator logs contain only a provider status code or a
network-failure category, never provider bodies, recipient addresses or secrets.

The old behavior was reproduced by an expected failing local regression test.
The updated 16-case auth suite, two trial checks, all 162 compatibility tests and
four Topics-off cases pass (184 total), along with build/typecheck and both
production restart checks. Mobile/desktop light/dark captures were reviewed.
Backup b028 completed before the follow-up deployment. No new migration or
dependency is needed. The original release record follows.

The correction is deployed as **Heroku v56**, source
`48f180b660a861d8595815ef96b83df39cd30347`, and pushed to GitHub main and the
feature branch. Remote build/typecheck passed; release-phase Prisma found no
pending migrations. Hosted health, Google redirect and recovery-page smoke
checks passed again. The isolated local test database was stopped. Jonas has
been asked for one fresh Google sign-in to complete the recovery address on his
previously linked account and confirm receipt of its informational security email.
That email needs no verification action. Public activation remains approved and
awaits this final real-mail check; Google linking itself is already confirmed.

## Production status — November 22

The implementation is pushed to GitHub `main` and `feature/account-signin`.
Source `6bb580143f0c62287887c86508d099549de0b1c1` deployed to Heroku as **v54**.
The remote production build/typecheck passed; release-phase Prisma found 24
migrations and successfully applied only `202611210001_account_signin`. Backup
**b027** completed first. No production data was reset.

Configuration release **v55** completed successfully with the Google client ID,
Resend transport and the two-owner allowlist enabled for the immediate live
checks. Public signup and announcements remain off until those checks finish;
this is a release check, not a separate extended pilot. Existing secrets were
preserved, and no secret values were printed or committed.

Live browser checks passed: app/database health, mobile login layout, Google
provider/canonical callback, redirect to Google's actual login screen, recovery
form, invalid-token rejection and registration rendering without browser errors.
The first browser attempt began before Heroku's configuration release finished;
the check passed after that release succeeded, without an application change.

Jonas subsequently confirmed the real Google callback. The recovery setup and
email check were clarified in the follow-up above. Public activation, signup and
the in-app existing-user notice are approved and will be enabled after the
immediate checks. No bulk email announcement is planned.

## November 22 release authorization

Jonas installed the Google client secret and replacement Resend key in Heroku;
Codex verified their presence without displaying either value. Rollout was set
to `disabled` in v53 and the hosted health check passed. Jonas then requested
finishing the public launch promptly instead of a separate limited-trial phase.
This authorizes the application release and public activation after the immediate
integration checks. The earlier implementation-only and pending-approval notes
below describe the preceding stage and are superseded by this release instruction.

All application/test hashes still match the locally verified source. Backup
`b027` completed before release. See the production status above for observed
release and integration results. No new paid resource, Apple sign-in or bulk
email is included.
The owner still needs to complete a real Google login in their own browser.

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
