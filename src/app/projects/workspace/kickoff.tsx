"use client";

import { useState } from "react";
import { StateForm } from "@/components/state-form";
import { createWorkspaceAction } from "@/app/actions/workspace";

export function Kickoff({
  operationKey,
  starter,
}: {
  operationKey: string;
  starter: { title: string; brief: string; doneWhen: string; output: string }[];
}) {
  const [template, setTemplate] = useState("blank");
  return (
    <StateForm action={createWorkspaceAction} label="Create private project">
      <input type="hidden" name="operationKey" value={operationKey} />
      <label className="field">
        <span>Project name</span>
        <input name="title" required maxLength={80} />
      </label>
      <label className="field">
        <span>What are we making?</span>
        <textarea name="brief" required maxLength={3000} rows={4} />
      </label>
      <label className="field">
        <span>What counts as done?</span>
        <textarea name="doneWhen" required maxLength={1500} rows={3} />
      </label>
      <label className="field">
        <span>Due date (optional)</span>
        <input name="dueOn" type="date" />
      </label>
      <label className="field">
        <span>Starting point</span>
        <select
          name="template"
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
        >
          <option value="blank">Start blank</option>
          <option value="workshop">Use a workshop plan</option>
        </select>
      </label>
      {template === "workshop" && (
        <div className="workspace-stack">
          <p>
            Start the agenda and exercises in parallel. The handout uses the
            recommended exercise sheet.
          </p>
          {starter.map((task, index) => (
            <fieldset className="workspace-fieldset" key={task.title}>
              <legend>{task.title}</legend>
              <label className="field">
                <span>Task title</span>
                <input
                  name={`taskTitle${index}`}
                  defaultValue={task.title}
                  required
                  maxLength={100}
                />
              </label>
              <label className="field">
                <span>Brief</span>
                <textarea
                  name={`taskBrief${index}`}
                  defaultValue={task.brief}
                  required
                  rows={3}
                />
              </label>
              <label className="field">
                <span>Done when</span>
                <input
                  name={`taskDone${index}`}
                  defaultValue={task.doneWhen}
                  required
                />
              </label>
              <label className="field">
                <span>Output name</span>
                <input
                  name={`taskOutput${index}`}
                  defaultValue={task.output}
                  required
                  maxLength={120}
                />
              </label>
              <p className="muted">
                {index < 2
                  ? "Choose a reviewer after adding the team."
                  : "Ready once submitted."}
              </p>
            </fieldset>
          ))}
        </div>
      )}
    </StateForm>
  );
}
