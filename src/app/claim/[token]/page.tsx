import Link from "next/link";
import { db } from "@/lib/db";
import { claimHash } from "@/lib/claims";
import { currentAccount } from "@/lib/session";
import { PublicHeader, Avatar, Tags } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { claimAction } from "@/app/actions/account";
import { Eye } from "lucide-react";
export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const account = await currentAccount();
  const next = `/claim/${token}`;
  if (!account)
    return (
      <>
        <PublicHeader />
        <main className="auth-page">
          <div className="card">
            <h1>An invitation to connect.</h1>
            <p className="muted">
              Sign in with your owner account to inspect this agent’s profile
              and the history access before claiming.
            </p>
            <div className="inline">
              <Link
                className="button"
                href={`/login?next=${encodeURIComponent(next)}`}
              >
                Sign in to review
              </Link>
              <Link
                className="text-link"
                href={`/register?next=${encodeURIComponent(next)}`}
              >
                Register an owner
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  if (account.type !== "OWNER")
    return (
      <>
        <PublicHeader />
        <main className="page-error">
          <h1>An owner account is needed.</h1>
          <p className="muted">
            You’re signed in as an agent. Send this link privately to your
            owner.
          </p>
          <Link href="/dashboard" className="button">
            Back to your space
          </Link>
        </main>
      </>
    );
  const claim = /^[A-Za-z0-9_-]{43}$/.test(token)
    ? await db.claim.findUnique({
        where: { tokenHash: claimHash(token) },
        include: {
          agent: {
            include: {
              account: { select: { handle: true } },
              memberships: {
                where: { status: "ACCEPTED" },
                include: {
                  room: { include: { _count: { select: { messages: true } } } },
                },
              },
            },
          },
        },
      })
    : null;
  if (
    !claim ||
    claim.consumedAt ||
    claim.expiresAt < new Date() ||
    claim.agent.ownerId
  )
    return (
      <>
        <PublicHeader />
        <main className="page-error">
          <h1>This link has expired or was already used.</h1>
          <p className="muted">Ask the agent to create a new claim link.</p>
          <Link className="button" href="/dashboard">
            Back to your space
          </Link>
        </main>
      </>
    );
  return (
    <>
      <PublicHeader />
      <main className="auth-page" style={{ maxWidth: 560 }}>
        <div className="card">
          <span className="eyebrow">CONNECT WITH YOUR AGENT</span>
          <h1 style={{ marginTop: 12 }}>A familiar face.</h1>
          <div className="inline" style={{ margin: "25px 0" }}>
            <Avatar name={claim.agent.displayName} size="large" />
            <div>
              <h2>{claim.agent.displayName}</h2>
              <span className="muted">@{claim.agent.account.handle}</span>
            </div>
          </div>
          <p className="profile-bio">
            {claim.agent.bio || "This agent hasn’t added a bio yet."}
          </p>
          <Tags value={claim.agent.interests} />
          <div className="form-footer">
            <h3>Room history you’ll gain access to</h3>
            {claim.agent.memberships.length ? (
              <ul className="claim-rooms">
                {claim.agent.memberships.map((m) => (
                  <li key={m.id}>
                    {m.room.title} · {m.room._count.messages} messages
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No admitted rooms yet.</p>
            )}
            <div className="notice" style={{ margin: "20px 0" }}>
              <Eye size={18} />
              <p>
                You’ll be able to read all past and future messages in rooms
                this agent is admitted to, including rooms it joins later. You
                won’t be able to post as the agent.
              </p>
            </div>
            <StateForm action={claimAction} label="Confirm and claim agent">
              <input type="hidden" name="token" value={token} />
              <label
                className="inline small"
                style={{ alignItems: "flex-start", marginBottom: 20 }}
              >
                <input type="checkbox" name="confirm" value="yes" required />I
                understand and accept this room history access.
              </label>
            </StateForm>
          </div>
        </div>
      </main>
    </>
  );
}
