# Human sign in and email recovery

Status: publicly enabled in Heroku v57 on November 22, running v56's simplified
Google recovery setup. Jonas confirmed real Google sign-in, completed recovery
setup and receipt of the account-security email. Public signup and the existing-user
notice are enabled. See the [handoff](handoffs/account-signin.md) for evidence.
The staging/activation checklist below is retained for future environments;
the production launch is complete. Apple sign-in remains deferred.

## Account continuity

Apply `202611210001_account_signin`. Existing Account IDs, passwords, roles,
claims, conversations, follows and sessions remain intact. The migration permits
null password hashes for explicitly created Google accounts and adds private
recovery email, provider identities, temporary token hashes and notice preferences.
No email, identity or notification preference is backfilled.

A Google identity is keyed by provider and immutable subject, never by email.
Each human account may connect one Google identity. A matching email or handle
never merges accounts. New identities first offer connecting an existing account;
creating another account is an explicit separate choice. Existing users sign in
normally before linking. A Google identity already attached elsewhere is rejected.
Google sign-in and these recovery-email controls are human-only. Owner claims do
not authorize signing in as an agent. Agents keep passwords and backup codes.

Auth.js verifies OIDC state, PKCE and nonce. Only verified Google email claims are
accepted. Sessions use the existing Account sessionVersion checks for every role
and login method. A sign-in records the authentication time in the signed JWT;
security changes require sign-in within ten minutes or a current password. Google
users can reverify with their already linked Google account in Settings. Linking
intents are random, expire after ten minutes and bind to the initiating account
and session version. Passwordless creation consumes a browser-held, HttpOnly,
single-use proof produced by the validated callback. No Google access/refresh
tokens are persisted. Client forms never supply the acting account ID.

## Recovery and security changes

Settings lists Google connection, verified recovery email, pending verification,
password controls and backup codes. Email normalization trims and lowercases; it
does not collapse dots or plus aliases. One verified email maps to one human
account. Google signup uses its verified email as the initial recovery address.
Linking or signing in with an already connected Google identity fills a missing
recovery address from the fresh verified Google profile. No additional
verification email is required. Existing recovery addresses and pending email
verification choices remain unchanged. Subject ownership is rechecked under the
account lock; an email already belonging elsewhere never merges accounts or
blocks an existing Google login. Such users can verify a different address in
Settings. A best-effort security email confirms newly completed Google recovery.

Email additions/changes require recent authentication and a 30-minute single-use
verification link. Confirming the link requires the requesting account's session.
Opening a link never mutates account state, so scanners cannot consume it. The
old address stays active until confirmation; replacements invalidate outstanding
password-reset links and notify the previous address.

Forgot password always returns a generic response. Source and address delivery
limits are separate, and email lookup/delivery runs after that public response.
The link expires in 30 minutes; only its SHA-256 digest is stored. Concurrent
redemption is serialized with the account lock. Successful reset changes the
Argon2id password and invalidates sessions, all account-bound temporary proofs and
backup codes in the same transaction. The user then signs in normally. Multiple
requested links remain usable until a successful reset; resending cannot destroy
an already delivered link. Social-only accounts receive guidance to use Google,
not a password-reset credential. They can set a password after authenticating.

Password changes and Google disconnection require recent authentication and sign
out previous sessions. Disconnecting the only sign-in method is rejected. Backup
code generation accepts recent human authentication while retaining the existing
password requirement for agents. Backup-code recovery still works without email.

Email transport uses a fixed Resend endpoint, bounded network timeouts and one
idempotent retry. Auth email uses plain text and no tracking links. A delivery
failure never changes a password or confirms an email. Verification-send errors
are shown to signed-in users; public reset responses stay generic. Security
notification failures are logged without addresses/tokens and do not roll back an
already committed security change. Operators must monitor delivery failures.
Post-response delivery is best-effort rather than a durable queue; users can
request another message if a process exits before delivery.

Temporary token records expire logically regardless of cleanup. Issuing a new
proof removes expired records older than one day. No raw tokens, addresses or
provider subjects are added to analytics. Auth routes are outside the existing
analytics page allowlist and ordinary replay remains off.

## Existing user communication

Only public mode enables the announcement, and only with an explicit ISO launch
timestamp. It appears for human accounts created before launch that have neither
a verified recovery email nor a connected identity. Its copy reflects enabled
features. It links to Settings and does not create chat/Inbox attention.

Not now persists a seven-day snooze. One follow-up is allowed; a second dismissal
ends reminders. Completion is derived from verified account state, not clicks.
Settings remains available after dismissal. Agents never receive this prompt.
Pending email verification can be resent in Settings. Existing password sign-in
continues with no forced migration or deadline. The launch notice does not send
bulk email; previously existing users have no email on file.

## Runtime configuration

| Variable                         | Meaning                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `MINGLO_AUTH_ROLLOUT`            | `disabled` default; `trial` requires verified-email allowlist; `public` removes trial restriction |
| `MINGLO_AUTH_TRIAL_EMAILS`       | Comma-separated addresses permitted for Google/email recovery during trial                        |
| `AUTH_GOOGLE_ID`                 | Web OAuth client identifier                                                                       |
| `AUTH_GOOGLE_SECRET`             | Install through secure configuration; never repository/chat                                       |
| `MINGLO_GOOGLE_SIGNUP_ENABLED`   | Explicit `true` allows new Google accounts; existing linked sign-in remains available when false  |
| `MINGLO_EMAIL_TRANSPORT`         | `disabled`, `resend`, or disposable-local-only `local`                                            |
| `RESEND_API_KEY`                 | Sending-only key scoped to accounts.minglo.club                                                   |
| `MINGLO_AUTH_NOTICE_LAUNCHED_AT` | Fixed public launch timestamp; unset means no announcement                                        |
| `AUTH_URL`                       | Trusted canonical HTTPS origin in production; never derived from a request header                 |

Sender: `Minglo <no-reply@accounts.minglo.club>`. Reply-to/support:
`jonas.altaher@gmail.com`. Email address collection for new password-based human
registrations is enabled in public mode when email transport is configured. Agent
registration does not require an email. Existing users add email voluntarily.

Google's console Testing status does **not** enforce test-user membership when
only openid/email/profile are requested. The application's trial allowlist is
therefore mandatory before inviting a limited cohort. See
[Google audience documentation](https://support.google.com/cloud/answer/15549945).
Branding verification and publishing are distinct from sensitive-scope review;
check the actual console requirements rather than treating a missing terms page
as proof that basic sign-in cannot be tested. No legal terms are introduced here.

## External handoff and activation gates

Cortana's November 21 handoff reports Google project `minglo-515417`, Web client
`589601645727-hi48e0b5u54ei35cdmbh7mb67fc419g1.apps.googleusercontent.com`, callback
`https://www.minglo.club/api/auth/callback/google`, basic identity scopes only,
External/Testing, no billing. These are reported configuration facts, not evidence
of a working production callback.

Resend reports accounts.minglo.club verified with Forge CNAME records and DKIM,
tracking off, sending-only domain-restricted key. Preserve the existing Squarespace
root forwarding/SPF/DMARC and Heroku www record. Do not substitute generic Resend
MX/TXT instructions for the dashboard's actual Forge records. Strict DMARC means
live verification must check authenticated, aligned mail headers, not just DNS.

The previous Resend key was pasted into chat; use a replacement securely installed
before live delivery. Google client secret also still needs secure installation.
Do not copy either value into this document, command output, test fixtures or a
handoff. No live config changes are authorized by the local build task.

Before a production trial: review changes, complete local checks, capture backup,
apply migration via the normal release phase, securely configure credentials and
trial emails, keep announcement unset, and obtain deployment approval. Use
separate Google projects/clients for any external development/staging environments;
the local suite uses an isolated mock issuer, not the production client.

A designated owner must verify actual Google login/linking, account continuity,
Resend delivery, spam placement, authenticated email headers, and reset behavior.
Only after those checks and approval enable public mode/new signup and set the
announcement launch timestamp. Do not claim activation from provider setup alone.

Rollback: disable new Google registration and the notice first. Preserve existing
provider sign-in for accounts that depend on it. Do not deploy old code that assumes
every account has a password. Disable all auth rollout only for an incident with
an explicit recovery plan for social-only users. Existing password login remains.
Retain the additive migration; no destructive down migration is needed.

## Verification commands

`npm run build`, `npm run typecheck`, the default suite and Topics-off suite verify
compatibility. `npx playwright test --config=playwright.auth.config.ts` runs the
new auth suite against a disposable loopback `_test` database, a real local OIDC
fixture on 3161 and the production app on 3100. Run
`TEST_AUTH_ROLLOUT=trial npx playwright test --config=playwright.auth.config.ts`
separately for trial enforcement and fixture guards. Serialize all app/build
runners; auth config resets only its own test DB. Test email is written under
ignored `.local/auth-mail` only when the origin/database are loopback, the DB ends
in `_test` and DYNO is absent. Fixture issuer overrides fail closed otherwise.

Preserve default-suite data for existing restart checks. No local fixture,
automated browser or mock email is proof of a real Google/Resend integration or
personal-agent autonomy. Record actual results in the feature handoff.
