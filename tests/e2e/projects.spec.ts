import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import {
  changeProject,
  createProject,
  getProjectReturns,
  readProject,
} from "../../src/lib/projects";
import { setParticipationPaused } from "../../src/lib/participation";
import { setBlocked } from "../../src/lib/blocks";
import { login, password, register } from "./helpers";

const workshop = {
  title: "Workshop plan",
  brief: "A private workshop for 12 first-time facilitators.",
  doneWhen:
    "A one-page agenda with materials and exactly 60 minutes of activities.",
};

async function invite(creator: Page, handle: string, role: string) {
  const details = creator.getByText("Invite a collaborator", { exact: true });
  if (!(await details.evaluate((el) => el.parentElement?.hasAttribute("open"))))
    await details.click();
  await creator.getByLabel("Minglo handle").fill(handle);
  await creator.getByLabel("Invite as").selectOption(role);
  await creator
    .getByRole("button", { name: "Send project invitation" })
    .click();
  await expect(
    creator.locator(".project-list").getByText(`@${handle}`, { exact: true }),
  ).toBeVisible();
}

async function invitation(page: Page) {
  await page.goto("/dashboard");
  await page
    .getByRole("link", { name: "Review invitation to Workshop plan" })
    .click();
  await expect(page.getByText("Before you join")).toBeVisible();
  await expect(page.getByText(workshop.brief)).toHaveCount(0);
}

test("members complete the workshop across fresh visits and outsiders cannot read a saved result", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const creator = await browser.newPage();
  let drafter = await browser.newPage();
  const reviewer = await browser.newPage();
  const reader = await browser.newPage();
  const owner = await browser.newPage();
  await register(creator, "project_human", "OWNER");
  await register(drafter, "project_drafter", "AGENT");
  await register(reviewer, "project_reviewer", "AGENT");
  await register(reader, "project_reader", "OWNER");
  await register(owner, "project_outside", "OWNER");
  const connectedOwner = await db.owner.findFirstOrThrow({
    where: { account: { handle: "project_outside" } },
  });
  await db.agent.update({
    where: {
      accountId: (
        await db.account.findUniqueOrThrow({
          where: { handle: "project_drafter" },
        })
      ).id,
    },
    data: { ownerId: connectedOwner.id },
  });

  await creator.getByRole("link", { name: "Start a project" }).click();
  await creator.getByLabel("Project name").fill(workshop.title);
  await creator.getByLabel("What are we making?").fill(workshop.brief);
  await creator.getByLabel("What counts as done?").fill(workshop.doneWhen);
  await creator.getByRole("button", { name: "Create private project" }).click();
  await creator.waitForURL(/\/projects\/c[a-z0-9]{24}$/);
  const projectUrl = creator.url();
  await invite(creator, "project_reader", "READER");
  await invite(creator, "project_drafter", "DRAFTER");
  await invite(creator, "project_reviewer", "REVIEWER");

  for (const page of [reader, drafter, reviewer]) {
    expect((await page.goto(projectUrl))?.status()).toBe(404);
    await invitation(page);
    await page.getByRole("button", { name: "Join project" }).click();
    await expect(page.getByText(workshop.brief)).toBeVisible();
  }
  expect((await owner.goto(projectUrl))?.status()).toBe(404);
  await owner.goto("/inbox?view=updates");
  await expect(owner.getByText(workshop.title)).toHaveCount(0);

  await drafter.goto("/dashboard");
  await drafter.getByRole("link", { name: "Draft Workshop plan" }).click();
  await drafter.getByRole("button", { name: "Take drafting task" }).click();
  await drafter
    .getByLabel("Draft", { exact: true })
    .fill("10 min intro\n60 min exercises\n10 min closing");
  await drafter
    .getByRole("button", { name: "Submit version 1 for review" })
    .click();
  await drafter.waitForURL("**/versions/1");
  await drafter.close();

  await reviewer.goto("/inbox");
  await reviewer.getByRole("link", { name: "Project work for you" }).click();
  await reviewer
    .getByRole("link", { name: "Review Workshop plan · version 1" })
    .click();
  await reviewer.getByText("Request a change", { exact: true }).click();
  await reviewer
    .getByLabel("What needs to change?")
    .fill("The exercises run 20 minutes over.");
  await reviewer.getByRole("button", { name: "Send change request" }).click();
  await expect(
    reviewer.getByText("Waiting for @project_drafter", { exact: false }),
  ).toBeVisible();

  drafter = await browser.newPage();
  await login(drafter, "project_drafter");
  await drafter
    .getByRole("link", { name: "Revise Workshop plan after version 1" })
    .click();
  await expect(
    drafter.getByText("The exercises run 20 minutes over."),
  ).toBeVisible();
  await expect(drafter.getByLabel("Revised draft")).toHaveValue(
    /60 min exercises/,
  );
  await drafter
    .getByLabel("Revised draft")
    .fill(
      "Materials: flip chart and markers\n10 min intro\n40 min exercises\n10 min closing",
    );
  await drafter
    .getByRole("button", { name: "Submit version 2 for review" })
    .click();
  await drafter.waitForURL("**/versions/2");

  await reviewer.goto("/dashboard");
  await reviewer
    .getByRole("link", { name: "Review Workshop plan · version 2" })
    .click();
  await expect(reviewer).toHaveURL(/\/versions\/2$/);
  const reviewerAgent = await db.agent.findFirstOrThrow({
    where: { account: { handle: "project_reviewer" } },
  });
  await setParticipationPaused(reviewerAgent.accountId, reviewerAgent.id, true);
  await reviewer.reload();
  await expect(
    reviewer.getByText("Your participation is paused.", { exact: false }),
  ).toBeVisible();
  await expect(
    reviewer.getByRole("button", { name: "Recommend version 2" }),
  ).toHaveCount(0);
  await setParticipationPaused(
    reviewerAgent.accountId,
    reviewerAgent.id,
    false,
  );
  await reviewer.reload();
  await reviewer
    .getByLabel("Recommendation note")
    .fill("The agenda totals 60 minutes.");
  await reviewer.getByRole("button", { name: "Recommend version 2" }).click();
  await expect(
    reviewer.getByText("Waiting for @project_human", { exact: false }),
  ).toBeVisible();

  await creator.goto("/dashboard");
  const decisionLink = creator.getByRole("link", {
    name: "Approve version 2 of Workshop plan",
  });
  const decisionPath = (await decisionLink.getAttribute("href"))!;
  await reader.goto(decisionPath);
  await expect(reader.getByText("The agenda totals 60 minutes.")).toBeVisible();
  await expect(
    reader.getByRole("button", { name: "Approve version 2" }),
  ).toHaveCount(0);
  const freshCreator = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await freshCreator.goto(decisionPath);
  await expect(freshCreator).toHaveURL(/\/login\?next=/);
  await freshCreator
    .getByLabel("Handle", { exact: true })
    .fill("project_human");
  await freshCreator.getByLabel("Password", { exact: true }).fill(password);
  await freshCreator
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(freshCreator).toHaveURL(new RegExp(`${decisionPath}$`));
  await expect(
    freshCreator.getByText("The agenda totals 60 minutes."),
  ).toBeVisible();
  expect(
    await freshCreator.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await freshCreator.screenshot({
    path: info.outputPath("decision-light-mobile.png"),
    fullPage: true,
  });
  await freshCreator.evaluate(() =>
    localStorage.setItem("minglo-theme", "dark"),
  );
  await freshCreator.reload();
  await expect(
    freshCreator.getByRole("button", { name: "Approve version 2" }),
  ).toBeVisible();
  await freshCreator.screenshot({
    path: info.outputPath("decision-dark-mobile.png"),
    fullPage: true,
  });
  const approve = freshCreator.getByRole("button", {
    name: "Approve version 2",
  });
  await approve.focus();
  await freshCreator.keyboard.press("Enter");
  await expect(
    freshCreator.getByRole("heading", { name: "Accepted result · Version 2" }),
  ).toBeVisible();

  await reader.goto("/dashboard");
  await reader.getByRole("link", { name: "Your projects" }).click();
  await reader
    .getByRole("link", { name: "Workshop plan", exact: true })
    .click();
  await expect(
    reader.getByText(
      "Drafted by @project_drafter · Recommended by @project_reviewer · Approved by @project_human",
    ),
  ).toBeVisible();
  await expect(reader.getByText(/40 min exercises/)).toBeVisible();
  await creator.goto(projectUrl);
  await creator.getByRole("button", { name: "Remove @project_reader" }).click();
  await expect(
    creator.getByText("@project_human removed @project_reader"),
  ).toBeVisible();
  expect((await reader.goto(`${projectUrl}/versions/2`))?.status()).toBe(404);
  await reader.goto("/dashboard");
  await expect(reader.getByRole("link", { name: "Your projects" })).toHaveCount(
    0,
  );
});

test("project transitions serialize retries, reject stale decisions, and recheck pause and membership", async () => {
  const [creator, writer, reviewer, replacement] = await Promise.all(
    ["owner", "writer", "reviewer", "replacement"].map((name) =>
      db.account.create({
        data: {
          handle: `transition_${name}`,
          type: name === "owner" ? "OWNER" : "AGENT",
          ...(name === "owner"
            ? { owner: { create: { displayName: name } } }
            : { agent: { create: { displayName: name } } }),
        },
        include: { agent: true },
      }),
    ),
  );
  const creation = { ...workshop, operationKey: randomUUID() };
  const [{ id }, retriedCreate] = await Promise.all([
    createProject(creator.id, creation),
    createProject(creator.id, creation),
  ]);
  expect(retriedCreate.id).toBe(id);
  async function input(command: Record<string, unknown>) {
    const project = await db.project.findUniqueOrThrow({ where: { id } });
    return {
      operationKey: randomUUID(),
      expectedRevision: project.revision,
      command,
    };
  }
  async function change(actorId: string, kind: string, values = {}) {
    return changeProject(actorId, id, await input({ kind, ...values }));
  }
  async function inviteAndJoin(account: typeof writer, role: string) {
    await change(creator.id, "INVITED", { handle: account.handle, role });
    const membership = await db.projectMembership.findUniqueOrThrow({
      where: { projectId_accountId: { projectId: id, accountId: account.id } },
    });
    await change(account.id, "JOINED", {
      invitationId: membership.id,
      generation: membership.generation,
    });
    return membership;
  }
  await inviteAndJoin(writer, "DRAFTER");
  const oldInvitation = await inviteAndJoin(reviewer, "REVIEWER");
  await inviteAndJoin(replacement, "READER");
  await change(writer.id, "TAKEN");

  const draft = await input({
    kind: "SUBMITTED",
    baseVersion: 0,
    body: "Draft version one",
  });
  const same = await Promise.all([
    changeProject(writer.id, id, draft),
    changeProject(writer.id, id, draft),
  ]);
  expect(same).toEqual([{ version: 1 }, { version: 1 }]);
  await expect(
    changeProject(writer.id, id, {
      ...draft,
      command: { ...draft.command, body: "Different" },
    }),
  ).rejects.toThrow(/already used/);
  await expect(
    changeProject(writer.id, id, { ...draft, operationKey: randomUUID() }),
  ).rejects.toThrow(/changed/);
  expect((await getProjectReturns(reviewer.id)).items).toHaveLength(1);
  expect(await db.projectVersion.count({ where: { projectId: id } })).toBe(1);
  await setBlocked(reviewer.id, writer.id, true);
  await expect(
    change(reviewer.id, "CHANGES_REQUESTED", {
      version: 1,
      note: "Cut the exercises",
    }),
  ).rejects.toThrow(/handoff is unavailable/);
  await setBlocked(reviewer.id, writer.id, false);
  await change(reviewer.id, "CHANGES_REQUESTED", {
    version: 1,
    note: "Cut the exercises",
  });

  await setParticipationPaused(writer.id, writer.agent!.id, true);
  await expect(
    change(writer.id, "SUBMITTED", { baseVersion: 1, body: "Paused version" }),
  ).rejects.toThrow(/paused/);
  await setParticipationPaused(writer.id, writer.agent!.id, false);
  const revised = await input({
    kind: "SUBMITTED",
    baseVersion: 1,
    body: "Draft version two",
  });
  const race = await Promise.allSettled([
    changeProject(writer.id, id, revised),
    changeProject(writer.id, id, { ...revised, operationKey: randomUUID() }),
  ]);
  expect(race.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
  expect(await db.projectVersion.count({ where: { projectId: id } })).toBe(2);
  await expect(
    change(reviewer.id, "RECOMMENDED", { version: 1, note: "Stale" }),
  ).rejects.toThrow(/current version/);
  await change(reviewer.id, "RECOMMENDED", { version: 2, note: "Ready" });
  const recommended = await readProject(creator.id, id, 2);
  const stale = await input({
    kind: "APPROVED",
    version: 2,
    recommendationId: recommended!.recommendation!.id,
  });

  await change(creator.id, "REMOVED", { accountId: reviewer.id });
  expect(await readProject(reviewer.id, id)).toBeNull();
  await expect(changeProject(creator.id, id, stale)).rejects.toThrow(/changed/);
  await change(creator.id, "INVITED", {
    handle: reviewer.handle,
    role: "READER",
  });
  await expect(
    change(reviewer.id, "JOINED", {
      invitationId: oldInvitation.id,
      generation: oldInvitation.generation,
    }),
  ).rejects.toThrow(/unavailable/);
  await change(creator.id, "ASSIGNED", {
    accountId: replacement.id,
    role: "REVIEWER",
  });
  await change(replacement.id, "RECOMMENDED", {
    version: 2,
    note: "Reviewed by replacement",
  });
  const current = await readProject(creator.id, id, 2);
  await expect(
    change(creator.id, "APPROVED", {
      version: 2,
      recommendationId: recommended!.recommendation!.id,
    }),
  ).rejects.toThrow(/current recommendation/);
  await change(creator.id, "APPROVED", {
    version: 2,
    recommendationId: current!.recommendation!.id,
  });
  await expect(
    change(writer.id, "SUBMITTED", { baseVersion: 2, body: "Too late" }),
  ).rejects.toThrow(/no longer your turn/);
  await change(creator.id, "CLOSED");
  expect((await readProject(creator.id, id))?.output?.body).toBe(
    "Draft version two",
  );
  expect((await getProjectReturns(reviewer.id)).items).toHaveLength(0);
  expect(
    await db.projectEvent.count({
      where: { projectId: id, kind: "SUBMITTED" },
    }),
  ).toBe(2);
});
