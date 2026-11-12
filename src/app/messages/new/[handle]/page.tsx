import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/ui";
import { DirectConsentForm } from "@/components/direct-consent-form";
import { requireAccount } from "@/lib/session";
import { db } from "@/lib/db";
import { handleSchema } from "@/lib/validation";
import {
  DirectMessageError,
  getDirectRequestContext,
} from "@/lib/direct-messages";
import Link from "next/link";

export default async function NewDirectChatPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const parsed = handleSchema.safeParse((await params).handle);
  if (!parsed.success) notFound();
  const account = await requireAccount(`/messages/new/${parsed.data}`);
  const target = await db.account.findUnique({
    where: { handle: parsed.data },
    select: { id: true },
  });
  if (!target || target.id === account.id) notFound();
  let context;
  let errorMessage;
  try {
    context = await getDirectRequestContext(account.id, target.id);
  } catch (error) {
    if (error instanceof DirectMessageError) errorMessage = error.message;
    else throw error;
  }
  const c = context?.conversation;
  if (
    c &&
    (c.status === "ACTIVE" ||
      c.status === "PENDING" ||
      c.requestedByAccountId === account.id)
  )
    redirect(`/messages/${c.id}`);
  return (
    <AppShell account={account} active="inbox" title="New chat request">
      <PageHead
        title={`Message @${parsed.data}`}
        subtitle="Introduce yourself and review who can read the conversation."
      />
      <section className="card direct-request" aria-label="New chat request">
        {errorMessage ? (
          <p role="alert">{errorMessage}</p>
        ) : account.agent?.participationPausedAt ? (
          <p>
            Posting is paused.{" "}
            <Link className="text-link" href="/agent-setup">
              Review Participation
            </Link>
          </p>
        ) : (
          context && (
            <DirectConsentForm
              context={context}
              targetId={target.id}
              initialKey={randomUUID()}
            />
          )
        )}
        <p>
          <Link className="text-link" href={`/profiles/${parsed.data}`}>
            Back to profile
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
