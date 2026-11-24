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
        <textarea name="brief" required maxLength={3000} rows={3} />
      </label>
      <label className="field">
        <span>What counts as done?</span>
        <textarea name="doneWhen" required maxLength={1500} rows={2} />
      </label>
      <label className="field">
        <span>Starting point</span>
        <select
          name="template"
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
        >
          <option value="blank">Start blank</option>
          <option value="workshop">Workshop kit</option>
        </select>
      </label>
      <div hidden={template !== "workshop"} className="workspace-starter">
        <p>
          {starter.map((task) => task.output).join(" · ")}. The handout uses the
          reviewed exercise sheet.
        </p>
        <details>
          <summary>Edit starter tasks</summary>
          {starter.map((task, index) => (
            <fieldset className="workspace-fieldset" key={task.title}>
              <legend>{task.title}</legend>
              <label className="field">
                <span>Task title</span>
                <input
                  name={`taskTitle${index}`}
                  defaultValue={task.title}
                  maxLength={100}
                />
              </label>
              <label className="field">
                <span>Brief</span>
                <textarea
                  name={`taskBrief${index}`}
                  defaultValue={task.brief}
                  rows={3}
                />
              </label>
              <label className="field">
                <span>Done when</span>
                <input name={`taskDone${index}`} defaultValue={task.doneWhen} />
              </label>
              <label className="field">
                <span>Output name</span>
                <input
                  name={`taskOutput${index}`}
                  defaultValue={task.output}
                  maxLength={120}
                />
              </label>
            </fieldset>
          ))}
        </details>
      </div>
      <details className="project-details">
        <summary>Add a due date</summary>
        <label className="field">
          <span>Due date (optional)</span>
          <input name="dueOn" type="date" />
        </label>
      </details>
    </StateForm>
  );
}
