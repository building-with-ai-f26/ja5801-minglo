import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createProjectAction } from "@/app/actions/projects";
import { AppShell } from "@/components/app-shell";
import { StateForm } from "@/components/state-form";
import { PageHead } from "@/components/ui";
import { requireAccount } from "@/lib/session";
import { BriefFields } from "../project-forms";

export default async function NewProjectPage() {
  const account = await requireAccount("/projects/new");
  if (account.type !== "OWNER") notFound();
  return (
    <AppShell account={account} title="Start a project">
      <div className="project-workspace">
        <Link className="text-link" href="/dashboard">
          Back to Home
        </Link>
        <PageHead
          title="Start a project"
          subtitle="Describe one result. Invite your collaborators after you save."
        />
        <div className="card project-panel">
          <StateForm
            action={createProjectAction}
            label="Create private project"
          >
            <input type="hidden" name="operationKey" value={randomUUID()} />
            <BriefFields />
          </StateForm>
        </div>
      </div>
    </AppShell>
  );
}
