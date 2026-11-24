import { randomUUID } from "node:crypto";
import { workspaceAction } from "@/app/actions/workspace";
import { StateForm } from "@/components/state-form";
import type { WorkspaceView } from "@/lib/projects/queries";

export function Field({
  label,
  name,
  value,
  type = "text",
  rows,
  maxLength = 3000,
  required = true,
}: {
  label: string;
  name: string;
  value?: string | null;
  type?: string;
  rows?: number;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {rows ? (
        <textarea
          name={name}
          defaultValue={value ?? ""}
          rows={rows}
          maxLength={maxLength}
          required={required}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value ?? ""}
          maxLength={maxLength}
          required={required}
        />
      )}
    </label>
  );
}

export function Action({
  id,
  path,
  kind,
  label,
  values,
  secondary = false,
  children,
}: {
  id: string;
  path: string;
  kind: string;
  label: string;
  secondary?: boolean;
  values?: Record<string, string | number>;
  children?: React.ReactNode;
}) {
  return (
    <StateForm
      action={workspaceAction.bind(null, id, path)}
      label={label}
      secondary={secondary}
    >
      <input name="operationKey" type="hidden" value={randomUUID()} />
      <input name="kind" type="hidden" value={kind} />
      {Object.entries(values ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      {children}
    </StateForm>
  );
}

export function MemberSelect({
  view,
  name,
  label,
  value,
  pending = false,
  human = false,
  required = false,
  selfLabel = false,
}: {
  view: WorkspaceView;
  name: string;
  label: string;
  value?: string | null;
  pending?: boolean;
  human?: boolean;
  required?: boolean;
  selfLabel?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        name={name}
        aria-label={label}
        defaultValue={value ?? ""}
        required={required}
      >
        <option value="">
          {required ? "Choose a teammate" : "Unassigned"}
        </option>
        {view.project.memberships
          .filter(
            (entry) =>
              entry.contributor &&
              (pending || entry.status === "ACCEPTED") &&
              (!human || entry.account.type === "OWNER"),
          )
          .map((entry) => (
            <option key={entry.id} value={entry.accountId}>
              @{entry.account.handle}
              {selfLabel &&
                entry.accountId === view.actor.accountId &&
                " (assign to me)"}
              {entry.status === "INVITED" ? " (invited)" : ""}
            </option>
          ))}
      </select>
    </label>
  );
}

export function author(view: WorkspaceView, id?: string | null) {
  if (!id) return "Unassigned";
  const handle =
    view.names[id] ??
    view.project.memberships.find((entry) => entry.accountId === id)?.account
      .handle;
  return handle ? `@${handle}` : "Former member";
}

export const readinessLabels = {
  SUBMITTED: "Submitted",
  RECOMMENDED: "Recommended",
  APPROVED: "Human approved",
} as const;

export function ReadinessSelect({
  value = "SUBMITTED",
}: {
  value?: keyof typeof readinessLabels;
}) {
  return (
    <label className="field">
      <span>Ready when</span>
      <select name="readiness" defaultValue={value}>
        {Object.entries(readinessLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
