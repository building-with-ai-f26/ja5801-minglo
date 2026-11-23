"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { safeNext } from "@/lib/validation";
import { changeProject, createProject, ProjectError } from "@/lib/projects";
import type { FormState } from "./account";

function readInteger(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && /^(?:0|[1-9][0-9]{0,8})$/.test(value)
    ? Number(value)
    : Number.NaN;
}

function refreshProjects() {
  for (const path of ["/dashboard", "/inbox", "/projects"])
    revalidatePath(path);
}

export async function createProjectAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount("/projects/new");
  let id: string;
  try {
    ({ id } = await createProject(account.id, {
      title: form.get("title"),
      brief: form.get("brief"),
      doneWhen: form.get("doneWhen"),
      operationKey: form.get("operationKey"),
    }));
  } catch (error) {
    if (error instanceof ProjectError) return { error: error.message };
    throw error;
  }
  refreshProjects();
  redirect(`/projects/${id}`);
}

export async function changeProjectAction(
  projectId: string,
  returnTo: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const account = await requireAccount(returnTo);
  const kind = form.get("kind");
  let result: Awaited<ReturnType<typeof changeProject>>;
  try {
    result = await changeProject(account.id, projectId, {
      operationKey: form.get("operationKey"),
      expectedRevision: readInteger(form, "revision"),
      command: {
        kind,
        title: form.get("title"),
        brief: form.get("brief"),
        doneWhen: form.get("doneWhen"),
        role: form.get("role"),
        handle: form.get("handle"),
        accountId: form.get("accountId"),
        invitationId: form.get("invitationId"),
        generation: readInteger(form, "generation"),
        baseVersion: readInteger(form, "baseVersion"),
        body: form.get("body"),
        version: readInteger(form, "version"),
        note: form.get("note"),
        recommendationId: form.get("recommendationId"),
      },
    });
  } catch (error) {
    if (error instanceof ProjectError) return { error: error.message };
    throw error;
  }
  refreshProjects();
  const path = `/projects/${projectId}`;
  revalidatePath(path, "page");
  if (kind === "LEFT" || kind === "DECLINED") redirect("/projects");
  if (kind === "TAKEN") redirect(safeNext(`${path}/task`));
  if (kind === "SUBMITTED" && result.version)
    redirect(safeNext(`${path}/versions/${result.version}`));
  redirect(safeNext(path));
}
