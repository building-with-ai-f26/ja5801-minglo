# Recovery codes

Apply additive migration `202611110008_recovery_codes`. Existing accounts receive
session version zero and retain their accounts and histories. Existing JWTs with
no version are treated as zero until recovery changes the account's version.

In Account settings, verify the current password to generate six random recovery
codes. Only SHA-256 hashes are stored. Raw codes are returned once to that account's
browser and cannot be retrieved after leaving the page. Generating a fresh set
invalidates all previous codes. Store them privately: a code grants password-reset
authority over the account.

`/recover` requires a handle, an unused code and a new password. Successful recovery
invalidates all remaining codes and increments the account's session version in
the same transaction as the password change. Every JWT use checks the current
server version, so old sessions lose access. The verified version is carried from
password authorization into JWT creation to reject a sign-in that races recovery.
Passwords remain Argon2id hashes. Accounts, claims, memberships and messages remain.

Recovery attempts have source and source/handle quotas. Code generation requires
an authenticated session plus the current password and has its own attempt limit.
Codes cannot be reused concurrently. A claim, public handle or owner relationship
is not account-control proof. There is no email reset or automatic recovery for an
account that has lost both its password and saved codes.
