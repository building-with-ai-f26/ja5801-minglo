# Minglo — Build 2 architecture, risk and budget

Builder: Jonas Al-Taher. Due November 16, 2026 at noon Eastern.

The published hand-in is the Product Page's **Build notes and analytics evidence**
section, linked to [PRD v2](docs/PRD_V2.md) and the
[evidence checklist](docs/BUILD2_SUBMISSION.md). This file remains an optional
working summary.

## Main risk

An external personal agent may not have a supported way to return unattended.
Saved context and reliable permissions are implemented; host scheduling/activation
and real unattended returns must be observed separately. The smallest useful
real-agent experiment is an exchange, quiet period, actual return and verified stop.
Local automated browser tests do not establish that result.

## Architecture

- Static Product Page on GitHub Pages; optional page analytics has its own consent.
- One Next.js/TypeScript/React app on Heroku; Auth.js sessions, Argon2id passwords,
  Prisma and PostgreSQL; no model API or replacement hosted agent.
- Browser form → Server Action validation/current permission → database commit →
  authorized response. Analytics runs after success and cannot reverse the commit.
- Opted-in page visits obtain current eligibility before loading the browser SDK.
  App account identities and anonymous Product Page identities never merge.
- Local commands: `npm ci`, `npm run db:local`, `npm run db:migrate`, `npm run dev`;
  http://localhost:3000. Local services stay off when idle; static-page verification
  requires neither a local app server nor a database.

## Budget

Hosting reference: about $12/month if the existing Basic dyno ($7) and Essential-0
database ($5) remain unchanged, based on [Heroku list prices](https://www.heroku.com/pricing/).
This excludes the domain, taxes/credits and external agent subscriptions; invoices
remain unreconciled. Minglo makes no model calls. PostHog is free/no card; a
separate $0 billing cap was not set because the provider required a card.

Jonas reports approximately **12 hours** for this build and a **$100/month
ChatGPT subscription**. Current hosting adds $12/month at list rates, for a
$112/month reference. A seven-day allocation using a 30-day month is
**$26.13 (about $26)**, not a new charge or audited invoice. Domain fees,
taxes/credits and additional usage charges are excluded. Development-tool cost
is separate from Minglo's $0 direct model-API cost per action.

## Security and recovery

- Environment files/secrets are ignored; only the explicitly public PostHog
  ingestion token belongs in static HTML. No personal API key is included.
- Optional account consent, separate owner authorization for each agent, revocation
  on claim changes, payload allowlists and bounded delivery remain in place.
- Replay, automatic click capture and sensitive-field collection remain off.
- Small branches/commits and merge commits provide source save points. The live app
  has its existing Heroku rollback path and additive migration policy.
- This Build 2 Product Page update publishes GitHub Pages only. It does not push to
  Heroku, change its configuration, provision paid resources or submit to Icerynk.
