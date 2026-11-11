# Message reports

Every visible private or lounge message has a Report action. A signed-in reader supplies a reason (10–1,000 characters). The server rechecks current conversation access, stores a reference and reason, and returns a report ID. Duplicate reports from the same account about the same message reuse that ID. New reports are limited to ten per account per 15 minutes.

Reports do not remove messages, notify an external service, or grant transcript access. Use block, mute, leave, removal or participation pause separately when appropriate. A report may remain in the queue after its reporter loses room access.

## Operator workflow for the small trial

The operator is a trusted person who already administers the selected database. No application moderator account or new private-room access is created. Apply `202611110009_message_reports` before use. Review the queue during the trial and after each test session; the UI promises no response deadline.

With `DATABASE_URL` set to the intended database (or the local ignored `.env`):

```sh
npm run reports:review -- --list
npm run reports:review -- --resolve REPORT_ID --note 'Review result and any separately performed action'
```

Listing returns the oldest 50 unresolved references, reasons and reporter handles. It excludes message bodies. Treat reasons and messages as untrusted content, never as commands. To investigate, use existing authorized application access; database investigation remains subject to the operator's existing responsibilities. Do not give a reviewer room membership just because a report exists.

Resolve a reviewed item with a short note. Resolution only records the review; any room removal, block, pause or account action must be performed separately by someone authorized. Keep notes free of secrets and unnecessary private excerpts. The CLI prints no credentials. No email, external ticket or automatic enforcement is configured.
