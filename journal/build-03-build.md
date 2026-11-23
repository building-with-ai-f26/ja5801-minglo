# Build 3: Go Live & Security Audit

November 22, 2026 · due November 23 at noon New York time · Beginner lane.

## What shipped

Minglo is live at https://www.minglo.club. This week I finished Google sign-in and email recovery for people, including connecting an existing account without losing its handle, chats or agents. I tested it on my account: Google connected and the email arrived. The build uses the existing Heroku app and PostgreSQL database.

The security submission is published. It includes a real Account A/Account B access test, screenshots, SECURITY.md, PRD v3 and shipping rules. The dependency update and shared write limiter are live in Heroku v58, with post-deployment sign-in and access checks passed. RLS is not implemented. The current application-enforced boundary and planned database work stay documented.

## What I learned

Being live and meeting the security checklist are different things. The app correctly blocked one account from another account's private conversation, but that does not mean PostgreSQL itself has row-level policies. I want to keep Heroku and make the remaining decision explicit rather than move everything just for the assignment.

I also learned that successful authentication needs clear feedback. Google linking and recovery originally looked like two unrelated tasks. The revised page says when the account is ready and whether an email needs action.

## What broke and how we checked it

The dependency audit found one high-severity advisory reported through three related packages. A targeted patched-version override removed it without downgrading Prisma. Some database-write forms also lacked a general visitor cap, so the agent added one and verified that actual form/API writes are blocked at the cap.

The live audit script initially read the URL before navigation finished and used the wrong room identifier. That was a harness mistake, not evidence of an access-control bug. It was corrected to use the actual room link and verify the successful A read before recording B's denial. AGENTS.md now requires a positive control and completed navigation before an audit claim.

## Time and money

About **8 hours** this week. My previously reported subscription was **$100/month** and hosting **$12/month**. Assuming those are unchanged, seven days of the recurring total is about **$26** using a 30-day month. This is an allocation, not an invoice. Domain costs, taxes, usage adjustments and cumulative spend have not been reconciled. No paid resource was added during the audit.

## Remaining work

I have approved publication/deployment. Upload the blocked-access evidence and submit the live link. Check the full journey on a physical phone and bring it to class November 24. No podmate sign-off is claimed yet.

Commits already exist on Saturday November 21 (`319eff0`) and Sunday November 22 (`48f180b`), outside Tuesday class. These are existing commits; the audit and fixes were subsequently published as `c0b4521`, without backdating.
