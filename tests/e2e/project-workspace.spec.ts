import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { createProject } from "../../src/lib/projects";
import { convertWorkspace } from "../../src/lib/projects/compatibility";
import { changeWorkspace } from "../../src/lib/projects/mutations";
import { createWorkspace } from "../../src/lib/projects/plan";
import { readWorkspace, workspaceQueue } from "../../src/lib/projects/queries";
import { login, register } from "./helpers";

async function go(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(
    new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"),
  );
}

test("four separate accounts hand off, review and deliver a workshop kit", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const lead = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  let agenda = await browser.newPage();
  const exercises = await browser.newPage();
  const handout = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  const outside = await browser.newPage();
  await register(lead, "workspace_lead", "OWNER");
  await register(agenda, "workspace_agenda", "AGENT");
  await register(exercises, "workspace_exercises", "AGENT");
  await register(handout, "workspace_handout", "OWNER");
  await register(outside, "workspace_outside", "OWNER");

  await lead.getByRole("link", { name: "Start a project" }).click();
  await lead.getByLabel("Project name").fill("Workshop kit");
  await lead
    .getByLabel("What are we making?")
    .fill("A private kit for a 60-minute workshop.");
  await lead
    .getByLabel("What counts as done?")
    .fill("Three usable outputs and a final human decision.");
  await lead.getByLabel("Starting point").selectOption("workshop");
  await expect(
    lead.getByRole("group", { name: "Draft the facilitator agenda" }),
  ).toBeVisible();
  await lead.getByRole("button", { name: "Create private project" }).click();
  await lead.waitForURL(/\/projects\/c[a-z0-9]{24}$/);
  const base = new URL(lead.url()).pathname;
  const taskRows = await db.workspaceTask.findMany({
    where: { projectId: base.split("/").at(-1)! },
    orderBy: { position: "asc" },
  });
  const [agendaPath, exercisePath, handoutPath] = taskRows.map(
    (task) => `${base}/tasks/${task.id}`,
  );
  expect((await outside.goto(base))?.status()).toBe(404);
  await go(lead, base + "/team");
  for (const [handle, page] of [
    ["workspace_agenda", agenda],
    ["workspace_exercises", exercises],
    ["workspace_handout", handout],
  ] as const) {
    await lead.getByLabel("Search by name or handle").fill(handle);
    await lead.getByRole("button", { name: "Search", exact: true }).click();
    await lead.getByRole("button", { name: `Invite @${handle}` }).click();
    await expect(
      lead
        .getByRole("heading", { name: "Pending invitations" })
        .locator("..")
        .getByText(`@${handle}`, { exact: true }),
    ).toBeVisible();
    expect((await page.goto(base))?.status()).toBe(404);
    await page.goto("/dashboard");
    await page
      .getByRole("link", { name: "Review invitation to Workshop kit" })
      .click();
    await expect(
      page.getByText("A private kit for a 60-minute workshop."),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Join project" }).click();
    await expect(page).toHaveURL(new RegExp(base + "$"));
  }
  for (const [route, owner, reviewer] of [
    [agendaPath, "workspace_agenda", "workspace_handout"],
    [exercisePath, "workspace_exercises", "workspace_lead"],
    [handoutPath, "workspace_handout", ""],
  ]) {
    await go(lead, route);
    await lead.getByText("Manage task", { exact: true }).click();
    await lead
      .getByLabel("Owner", { exact: true })
      .selectOption({ label: `@${owner}` });
    if (reviewer)
      await lead.getByLabel("Reviewer").selectOption({ label: `@${reviewer}` });
    await lead.getByRole("button", { name: "Save assignment" }).click();
    await expect(
      lead.getByText(`@${owner} owns this task`, { exact: false }),
    ).toBeVisible();
  }
  await go(handout, handoutPath);
  await expect(
    handout.getByText("Waiting for Design the exercises", { exact: true }),
  ).toBeVisible();
  await Promise.all(
    [
      [agenda, agendaPath],
      [exercises, exercisePath],
    ].map(async ([page, path]) => {
      const participant = page as Page;
      await go(participant, path as string);
      await participant.getByRole("button", { name: "Start task" }).click();
      await expect(participant.getByLabel("Working draft")).toBeVisible();
    }),
  );

  await agenda.getByLabel("Working draft").fill("# Agenda\n80 minutes.");
  await agenda.getByRole("button", { name: "Save draft" }).click();
  await expect(
    agenda.getByRole("heading", { name: "Continue saved draft" }),
  ).toBeVisible();
  await agenda.close();
  agenda = await browser.newPage();
  await login(agenda, "workspace_agenda");
  await go(agenda, agendaPath);
  await expect(agenda.getByLabel("Working draft")).toHaveValue(/80 minutes/);
  async function submit(
    page: Page,
    path: string,
    version: number,
    body: string,
    note: string,
  ) {
    await page.getByLabel("Working draft").fill(body);
    await page.getByLabel("What changed? Required when submitting").fill(note);
    await page
      .getByRole("button", { name: `Submit version ${version}` })
      .click();
    await expect(page).toHaveURL(
      new RegExp(path + "/versions/" + version + "$"),
    );
  }
  await submit(
    agenda,
    agendaPath,
    1,
    "# Agenda\n80 minutes.",
    "First timing draft.",
  );
  await go(handout, agendaPath + "/versions/1");
  await handout.getByText("Request changes", { exact: true }).click();
  await handout
    .getByLabel("What needs to change?")
    .fill("Cut 20 minutes from the agenda.");
  await handout.getByRole("button", { name: "Send change request" }).click();
  await expect(
    handout.getByText("Cut 20 minutes from the agenda.", { exact: true }),
  ).toBeVisible();
  await go(agenda, agendaPath);
  await submit(
    agenda,
    agendaPath,
    2,
    "# Agenda\n60 minutes.",
    "Cut 20 minutes.",
  );
  async function recommend(page: Page, path: string, version: number) {
    await go(page, `${path}/versions/${version}`);
    await page
      .getByLabel("Recommendation", { exact: true })
      .fill("Ready for the kit.");
    await page
      .getByRole("button", { name: `Recommend version ${version}` })
      .click();
    await expect(page.getByText(/recommended this version/)).toBeVisible();
  }

  await exercises.getByText("Ask for a decision", { exact: true }).click();
  await exercises
    .getByLabel("Question", { exact: true })
    .fill("Can attendees work in pairs?");
  await exercises
    .getByLabel("Needs an answer from")
    .selectOption({ label: "@workspace_lead" });
  await exercises.getByLabel("Block this task until answered").check();
  await exercises.getByRole("button", { name: "Send question" }).click();
  await expect(
    exercises.getByText("Waiting for a decision from @workspace_lead"),
  ).toBeVisible();
  await lead.goto("/projects");
  await lead
    .getByRole("link", { name: "Can attendees work in pairs?" })
    .click();
  await lead.getByLabel("Your answer").fill("Yes, use seated pairs.");
  await lead.getByRole("button", { name: "Send answer" }).click();
  await expect(lead.getByText("Yes, use seated pairs.")).toBeVisible();
  await exercises.goto("/dashboard");
  await exercises
    .getByRole("link", { name: "Read the answer to your question" })
    .click();
  await expect(exercises.getByText("Yes, use seated pairs.")).toBeVisible();
  await go(exercises, exercisePath);
  await submit(
    exercises,
    exercisePath,
    1,
    "# Exercises\n- Work in seated pairs",
    "Followed the lead’s decision.",
  );
  await recommend(lead, exercisePath, 1);
  await recommend(handout, agendaPath, 2);

  await go(handout, handoutPath);
  await expect(
    handout.getByRole("link", { name: "Exercise sheet v1" }),
  ).toBeVisible();
  await handout.getByRole("button", { name: "Start task" }).click();
  await submit(
    handout,
    handoutPath,
    1,
    "# Handout\nPick a partner before starting.",
    "Handout based on Exercise sheet v1.",
  );
  await go(lead, base + "/delivery");
  await lead
    .getByLabel("Release approver")
    .selectOption({ label: "@workspace_handout" });
  await lead
    .getByRole("button", { name: "Submit package for approval" })
    .click();
  await lead.waitForURL(/\/delivery\/c[a-z0-9]{24}$/);
  const release = new URL(lead.url()).pathname;
  await go(handout, release);
  await expect(
    handout.getByRole("heading", { name: "Facilitator agenda · Version 2" }),
  ).toBeVisible();
  await handout.getByRole("button", { name: "Approve package" }).click();
  await expect(
    handout.getByText("Approved package", { exact: true }),
  ).toBeVisible();
  const approved = await handout.request.get(release + "/download");
  expect(approved.status()).toBe(200);
  const contents = await approved.text();
  expect(contents).toContain("60 minutes.");
  expect(contents).toContain("Work in seated pairs");
  expect(contents).toContain("Pick a partner before starting.");
  expect((await outside.request.get(release + "/download")).status()).toBe(404);
  await go(lead, base + "/team");
  await lead.getByRole("button", { name: "Remove @workspace_handout" }).click();
  await expect(
    lead.getByText("@workspace_handout", { exact: true }),
  ).toHaveCount(0);
  expect((await handout.request.get(release + "/download")).status()).toBe(404);

  // Leave real persisted work for the production restart check.
  const leadAccount = await db.account.findUniqueOrThrow({
    where: { handle: "workspace_lead" },
  });
  const reviewer = await db.account.findUniqueOrThrow({
    where: { handle: "workspace_exercises" },
  });
  const project = await db.project.findUniqueOrThrow({
    where: { id: taskRows[0].projectId },
  });
  const act = (command: object) =>
    changeWorkspace(leadAccount.id, project.id, {
      operationKey: randomUUID(),
      command,
    });
  const followup = await act({
    kind: "TASK_ADDED",
    revision: project.planRevision,
    title: "Follow-up resources",
    brief: "An optional resources list",
    doneWhen: "Keep a draft",
    output: "Resources",
    required: false,
  });
  await act({
    kind: "ASSIGNED",
    taskId: followup.taskId,
    revision: 0,
    ownerId: leadAccount.id,
    readiness: "SUBMITTED",
  });
  await act({ kind: "TAKEN", taskId: followup.taskId, revision: 1 });
  await act({
    kind: "DRAFT_SAVED",
    taskId: followup.taskId,
    revision: 2,
    version: 0,
    draftRevision: 0,
    body: "Private resources in progress.",
  });
  await act({
    kind: "QUESTION_ASKED",
    taskId: followup.taskId,
    body: "Which resources are suitable for beginners?",
    responderId: reviewer.id,
    blocking: true,
  });
  expect(await (await lead.request.get(release + "/download")).text()).toBe(
    contents,
  );
});

test("solo starts immediately and old approvals convert once with exact versions", async () => {
  const human = await db.account.create({
    data: {
      handle: "workspace_solo",
      type: "OWNER",
      owner: { create: { displayName: "Solo test" } },
    },
  });
  const id = await createWorkspace(human.id, {
    title: "Solo",
    brief: "One author",
    doneWhen: "A result",
    operationKey: randomUUID(),
    template: "blank",
  });
  async function change(command: object) {
    return changeWorkspace(human.id, id, {
      operationKey: randomUUID(),
      command,
    });
  }
  const made = await change({
    kind: "TASK_ADDED",
    revision: 0,
    title: "Write it",
    brief: "Write",
    doneWhen: "Done",
    output: "Result",
    required: true,
  });
  const second = await change({
    kind: "TASK_ADDED",
    revision: 1,
    title: "Other work",
    brief: "Write",
    doneWhen: "Done",
    output: "Optional result",
    required: false,
  });
  await change({
    kind: "ASSIGNED",
    taskId: made.taskId,
    revision: 0,
    ownerId: human.id,
    readiness: "SUBMITTED",
  });
  await change({
    kind: "ASSIGNED",
    taskId: second.taskId,
    revision: 0,
    ownerId: human.id,
    readiness: "SUBMITTED",
  });
  await Promise.all(
    [made, second].map((item) =>
      change({ kind: "TAKEN", taskId: item.taskId, revision: 1 }),
    ),
  );
  expect((await workspaceQueue(human.id)).work).toHaveLength(2);
  const write = {
    operationKey: randomUUID(),
    command: {
      kind: "SUBMITTED",
      taskId: made.taskId,
      revision: 2,
      version: 0,
      draftRevision: 0,
      body: "A complete result.",
      note: "Initial",
    },
  };
  const retry = await changeWorkspace(human.id, id, write);
  expect((await changeWorkspace(human.id, id, write)).id).toBe(retry.id);
  await change({
    kind: "RELEASE_PREPARED",
    title: "Solo delivery",
    approverId: human.id,
    selections: [{ taskId: made.taskId, version: 1 }],
  });
  const legacy = await createProject(human.id, {
    title: "Legacy",
    brief: "Earlier work",
    doneWhen: "Approved",
    operationKey: randomUUID(),
  });
  await db.projectVersion.create({
    data: {
      projectId: legacy.id,
      number: 1,
      body: "Frozen original.",
      authorAccountId: human.id,
    },
  });
  await db.project.update({
    where: { id: legacy.id },
    data: {
      phase: "APPROVED",
      currentVersion: 1,
      approvedVersion: 1,
      revision: 1,
    },
  });
  await db.projectEvent.create({
    data: {
      projectId: legacy.id,
      actorAccountId: human.id,
      kind: "APPROVED",
      version: 1,
      revision: 1,
      operationKey: randomUUID(),
      requestHash: "fixture",
    },
  });
  await convertWorkspace(legacy.id, human.id);
  await convertWorkspace(legacy.id, human.id);
  const converted = await readWorkspace(human.id, legacy.id);
  expect(converted?.tasks).toHaveLength(1);
  expect(converted?.releases).toHaveLength(1);
  const exact = await readWorkspace(human.id, legacy.id, {
    releaseId: converted!.releases[0].id,
  });
  expect(exact?.items[0].saved.body).toBe("Frozen original.");
  expect(exact?.items[0].version).toBe(1);
});

test("legacy phases, invitations and reader rights survive conversion", async () => {
  const former = await db.account.create({
    data: {
      handle: "workspace_legacy_lead",
      type: "OWNER",
      owner: { create: { displayName: "Legacy lead" } },
    },
  });
  const reader = await db.account.create({
    data: {
      handle: "workspace_legacy_reader",
      type: "OWNER",
      owner: { create: { displayName: "Legacy reader" } },
    },
  });
  const agent = await db.account.create({
    data: {
      handle: "workspace_legacy_invite",
      type: "AGENT",
      agent: { create: { displayName: "Legacy invitation" } },
    },
  });
  const states = [
    ["SETUP", "OPEN"],
    ["DRAFTING", "WORKING"],
    ["REVIEW", "REVIEW"],
    ["REVISION", "REVISION"],
    ["DECISION", "APPROVAL"],
    ["APPROVED", "COMPLETE"],
  ] as const;
  const secondLead = await db.account.create({
    data: {
      handle: "workspace_legacy_second",
      type: "OWNER",
      owner: { create: { displayName: "Legacy lead two" } },
    },
  });
  for (const [phase, expected] of states) {
    const leadId = phase === "APPROVED" ? secondLead.id : former.id;
    const { id } = await createProject(leadId, {
      title: `Legacy ${phase}`,
      brief: "Private brief",
      doneWhen: "Saved",
      operationKey: randomUUID(),
    });
    const output = !["SETUP", "DRAFTING"].includes(phase);
    if (output)
      await db.projectVersion.create({
        data: {
          projectId: id,
          number: 1,
          body: "Prior body",
          authorAccountId: agent.id,
        },
      });
    await db.project.update({
      where: { id },
      data: {
        phase,
        currentVersion: output ? 1 : 0,
        approvedVersion: phase === "APPROVED" ? 1 : null,
        closedAt: phase === "APPROVED" ? new Date() : null,
      },
    });
    if (phase === "APPROVED")
      await db.projectEvent.create({
        data: {
          projectId: id,
          actorAccountId: leadId,
          kind: "APPROVED",
          operationKey: randomUUID(),
          requestHash: "fixture",
          version: 1,
          revision: 1,
        },
      });
    await db.projectMembership.create({
      data: {
        projectId: id,
        accountId: reader.id,
        status: "ACCEPTED",
        role: "READER",
      },
    });
    const invite = await db.projectMembership.create({
      data: {
        projectId: id,
        accountId: agent.id,
        status: "INVITED",
        generation: 5,
        role: "REVIEWER",
      },
    });
    await Promise.all([
      convertWorkspace(id, leadId),
      convertWorkspace(id, leadId),
    ]);
    const view = await readWorkspace(reader.id, id);
    expect(view?.tasks.map((task) => task.status)).toEqual([expected]);
    expect(view?.actor.contributor).toBe(false);
    expect(await readWorkspace(agent.id, id)).toBeNull();
    const migrated = await db.projectMembership.findUniqueOrThrow({
      where: { id: invite.id },
    });
    expect(migrated).toMatchObject({ generation: 5, status: "INVITED" });
  }
});

test("one agent can work with a lead, pin inputs, and deliver a second package", async () => {
  const human = await db.account.create({
    data: {
      handle: "workspace_pair_lead",
      type: "OWNER",
      owner: { create: { displayName: "Pair lead" } },
    },
  });
  const agent = await db.account.create({
    data: {
      handle: "workspace_pair_agent",
      type: "AGENT",
      agent: { create: { displayName: "Pair agent" } },
    },
  });
  const id = await createWorkspace(human.id, {
    title: "Pair project",
    brief: "Two tasks",
    doneWhen: "Inputs are pinned",
    operationKey: randomUUID(),
    template: "blank",
  });
  const act = (command: object, actorId = human.id) =>
    changeWorkspace(actorId, id, { operationKey: randomUUID(), command });
  const task = (taskId: string) =>
    db.workspaceTask.findUniqueOrThrow({ where: { id: taskId } });
  const project = () => db.project.findUniqueOrThrow({ where: { id } });
  const add = async (title: string) =>
    (
      await act({
        kind: "TASK_ADDED",
        revision: (await project()).planRevision,
        title,
        brief: title,
        doneWhen: "Done",
        output: title,
        required: true,
      })
    ).taskId!;
  const upstream = await add("Source");
  const downstream = await add("Synthesis");
  const link = async (taskId: string, prerequisiteId: string) =>
    act({
      kind: "DEPENDENCY_SAVED",
      revision: (await project()).planRevision,
      taskId,
      prerequisiteId,
      readiness: "SUBMITTED",
      remove: false,
    });
  await link(downstream, upstream);
  await expect(link(upstream, downstream)).rejects.toThrow("create a cycle");
  await act({ kind: "INVITED", handle: agent.handle, contributor: true });
  const membership = await db.projectMembership.findFirstOrThrow({
    where: { projectId: id, accountId: agent.id },
  });
  await expect(
    act(
      {
        kind: "JOINED",
        invitationId: membership.id,
        generation: membership.generation + 1,
      },
      agent.id,
    ),
  ).rejects.toThrow("unavailable");
  await act(
    {
      kind: "JOINED",
      invitationId: membership.id,
      generation: membership.generation,
    },
    agent.id,
  );
  const transition = async (
    taskId: string,
    command: object,
    actorId = human.id,
  ) =>
    act(
      { ...command, taskId, revision: (await task(taskId)).revision },
      actorId,
    );
  await transition(upstream, {
    kind: "ASSIGNED",
    ownerId: human.id,
    readiness: "SUBMITTED",
  });
  await transition(downstream, {
    kind: "ASSIGNED",
    ownerId: agent.id,
    readiness: "SUBMITTED",
  });
  await expect(
    transition(downstream, { kind: "TAKEN" }, agent.id),
  ).rejects.toThrow("required inputs");
  await transition(upstream, { kind: "TAKEN" });
  const submit = (
    taskId: string,
    version: number,
    body: string,
    actorId = human.id,
  ) =>
    transition(
      taskId,
      {
        kind: "SUBMITTED",
        version,
        draftRevision: 0,
        body,
        note: "Submitted evidence",
      },
      actorId,
    );
  await submit(upstream, 0, "Original source.");
  await transition(downstream, { kind: "TAKEN" }, agent.id);
  await transition(upstream, { kind: "REOPENED" });
  await submit(upstream, 1, "Second source.");
  await expect(
    submit(downstream, 0, "First synthesis.", agent.id),
  ).rejects.toThrow("newer input");
  await transition(
    downstream,
    {
      kind: "INPUT_RESOLVED",
      prerequisiteId: upstream,
      version: 2,
      keep: true,
      note: "Original data covers the original question.",
    },
    agent.id,
  );
  await submit(downstream, 0, "First synthesis.", agent.id);
  const prepare = (title: string, version: number, previousId?: string) =>
    act({
      kind: "RELEASE_PREPARED",
      title,
      approverId: human.id,
      previousId,
      selections: [
        { taskId: upstream, version: 2 },
        { taskId: downstream, version },
      ],
    });
  const stale = (await prepare("Needs refresh", 1)).releaseId!;
  await act({
    kind: "BRIEF_EDITED",
    title: "Pair project",
    brief: "Two tasks revised",
    doneWhen: "Inputs are pinned",
    revision: (await project()).planRevision,
  });
  await expect(
    act({ kind: "RELEASE_APPROVED", releaseId: stale }),
  ).rejects.toThrow("brief changed");
  const first = (await prepare("First delivery", 1, stale)).releaseId!;
  await expect(
    act({ kind: "RELEASE_APPROVED", releaseId: first }, agent.id),
  ).rejects.toThrow("designated human");
  await act({ kind: "RELEASE_APPROVED", releaseId: first });
  await transition(downstream, { kind: "REOPENED" });
  await submit(downstream, 1, "Second synthesis.", agent.id);
  const second = (await prepare("Second delivery", 2)).releaseId!;
  await act({ kind: "RELEASE_APPROVED", releaseId: second });
  const original = await readWorkspace(human.id, id, { releaseId: first });
  const newer = await readWorkspace(human.id, id, { releaseId: second });
  expect(original?.items.map((item) => item.saved.body)).toEqual([
    "Second source.",
    "First synthesis.",
  ]);
  expect(original?.items[1].saved.inputs).toEqual([
    expect.objectContaining({ taskId: upstream, version: 1 }),
  ]);
  expect(newer?.items.map((item) => item.saved.body)).toEqual([
    "Second source.",
    "Second synthesis.",
  ]);

  await transition(downstream, { kind: "REOPENED" });
  await transition(downstream, {
    kind: "ASSIGNED",
    ownerId: agent.id,
    reviewerId: human.id,
    readiness: "RECOMMENDED",
  });
  await submit(downstream, 2, "Third synthesis.", agent.id);
  await transition(downstream, {
    kind: "ASSIGNED",
    ownerId: human.id,
    reviewerId: agent.id,
    readiness: "RECOMMENDED",
  });
  await expect(
    transition(
      downstream,
      { kind: "RECOMMENDED", version: 3, note: "My own submission" },
      agent.id,
    ),
  ).rejects.toThrow("another contributor");
  await act({ kind: "CLOSED" });
  expect((await workspaceQueue(agent.id)).work).toHaveLength(0);
  expect(
    (await readWorkspace(human.id, id, { releaseId: first }))?.items[1].saved
      .body,
  ).toBe("First synthesis.");
});
