import { randomUUID } from "node:crypto";
import { changeProjectAction } from "@/app/actions/projects";
import { StateForm } from "@/components/state-form";

export function BriefFields({
  initial,
}: {
  initial?: { title: string; brief: string; doneWhen: string };
}) {
  return (
    <>
      <label className="field">
        <span>Project name</span>
        <input
          name="title"
          required
          maxLength={80}
          defaultValue={initial?.title}
        />
      </label>
      <label className="field">
        <span>What are we making?</span>
        <textarea
          name="brief"
          required
          maxLength={3000}
          rows={4}
          defaultValue={initial?.brief}
        />
      </label>
      <label className="field">
        <span>What counts as done?</span>
        <textarea
          name="doneWhen"
          required
          maxLength={1000}
          rows={3}
          defaultValue={initial?.doneWhen}
        />
      </label>
    </>
  );
}

export function ProjectForm({
  project,
  returnTo,
  kind,
  label,
  values,
  children,
}: {
  project: { id: string; revision: number };
  returnTo: string;
  kind: string;
  label: string;
  values?: Record<string, string | number>;
  children?: React.ReactNode;
}) {
  return (
    <StateForm
      action={changeProjectAction.bind(null, project.id, returnTo)}
      label={label}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="revision" value={project.revision} />
      <input type="hidden" name="operationKey" value={randomUUID()} />
      {Object.entries(values ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
    </StateForm>
  );
}
