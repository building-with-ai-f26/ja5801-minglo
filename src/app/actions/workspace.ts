"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { safeNext } from "@/lib/validation";
import { ProjectError } from "@/lib/projects";
import { convertWorkspace } from "@/lib/projects/compatibility";
import {
  changeWorkspace,
  markWorkspaceVisited,
} from "@/lib/projects/mutations";
import { createWorkspace } from "@/lib/projects/plan";
import { readWorkspace, workspaceCursor } from "@/lib/projects/queries";
import type { FormState } from "./account";

const optional = (form: FormData, field: string) =>
  form.get(field) || undefined;
const number = (value: FormDataEntryValue | null) =>
  typeof value === "string" && /^\d{1,9}$/.test(value)
    ? Number(value)
    : Number.NaN;
const message = (error: unknown) => {
  if (error instanceof ProjectError) return { error: error.message };
  throw error;
};
function refresh(id: string) {
  revalidatePath(`/projects/${id}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
}

export async function createWorkspaceAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const { id } = await requireAccount("/projects/new");
  let projectId: string;
  try {
    const template = form.get("template");
    projectId = await createWorkspace(id, {
      title: form.get("title"),
      brief: form.get("brief"),
      doneWhen: form.get("doneWhen"),
      dueOn: optional(form, "dueOn"),
      operationKey: form.get("operationKey"),
      template,
      starter:
        template === "workshop"
          ? [0, 1, 2].map((index) => ({
              title: form.get(`taskTitle${index}`),
              brief: form.get(`taskBrief${index}`),
              doneWhen: form.get(`taskDone${index}`),
              output: form.get(`taskOutput${index}`),
            }))
          : undefined,
    });
  } catch (error) {
    return message(error);
  }
  refresh(projectId);
  redirect(`/projects/${projectId}`);
}

export type WorkspaceFormState = FormState & { savedBody?: string };

export async function workspaceAction(
  projectId: string,
  path: string,
  _state: FormState,
  form: FormData,
): Promise<WorkspaceFormState> {
  const { id } = await requireAccount(path);
  const command = Object.fromEntries(form);
  const kind = form.get("kind");
  let receipt;
  try {
    if (kind === "CONVERT") {
      await convertWorkspace(projectId, id);
    } else if (kind === "VISITED") {
      const through = form.get("seenThrough");
      if (typeof through !== "string")
        return { error: "Activity is unavailable." };
      await markWorkspaceVisited(id, projectId, through);
    } else {
      for (const field of [
        "dueOn",
        "milestoneId",
        "ownerId",
        "reviewerId",
        "approverId",
        "previousId",
        "heading",
        "taskId",
        "url",
        "note",
      ])
        if (!command[field]) delete command[field];
      const parsed: Record<string, unknown> = { ...command };
      for (const field of [
        "revision",
        "version",
        "generation",
        "draftRevision",
      ])
        if (field in command) parsed[field] = number(command[field]);
      for (const field of [
        "contributor",
        "blocking",
        "accept",
        "remove",
        "keep",
        "required",
      ])
        parsed[field] = command[field] === "true";
      if (kind === "RELEASE_PREPARED") {
        const selected = form.getAll("selection");
        parsed.selections = selected.map((entry) => {
          const [taskId, version] =
            typeof entry === "string" ? entry.split(":") : [];
          return { taskId, version: number(version ?? null) };
        });
      }
      receipt = await changeWorkspace(id, projectId, {
        operationKey: form.get("operationKey"),
        command: parsed,
      });
    }
  } catch (error) {
    const result = message(error);
    const taskId = workspaceCursor(form.get("taskId"));
    if (taskId && (kind === "DRAFT_SAVED" || kind === "SUBMITTED")) {
      const view = await readWorkspace(id, projectId, { taskId });
      if (view?.task?.ownerId === id)
        return { ...result, savedBody: view.draft?.body ?? view.current?.body };
    }
    return result;
  }
  refresh(projectId);
  const base = `/projects/${projectId}`;
  if (kind === "LEFT" || kind === "DECLINED") redirect("/projects");
  if (receipt?.releaseId) redirect(`${base}/delivery/${receipt.releaseId}`);
  if (kind === "SUBMITTED" && receipt?.taskId && receipt.version)
    redirect(`${base}/tasks/${receipt.taskId}/versions/${receipt.version}`);
  if (kind === "JOINED" || kind === "CONVERT") redirect(base);
  redirect(safeNext(path));
}
