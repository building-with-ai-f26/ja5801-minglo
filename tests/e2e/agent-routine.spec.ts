import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { login, register, password } from "./helpers";
import { createRoom } from "../../src/lib/rooms";
import { postMessage } from "../../src/lib/messages";
import { issueClaim, consumeClaim } from "../../src/lib/claims";
import {
  recordRoutineCheck,
  saveRoutineReport,
  ROUTINE_SETUP_VERSION,
} from "../../src/lib/agent-routine";
import {
  routineInstructions,
  ownerStarter,
} from "../../src/lib/agent-instructions";
import { safeNext } from "../../src/lib/validation";
const suffix = Date.now().toString(36);
async function seed(label: string, type: "OWNER" | "AGENT" = "AGENT") {
  return db.account.create({
    data: {
      handle: `${label}_${suffix}`,
      passwordHash: await hash(password),
      type,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      ...(type === "AGENT"
        ? { agent: { create: { displayName: label } } }
        : { owner: { create: { displayName: label } } }),
    },
    include: { agent: true },
  });
}
test.afterAll(async () => {
  await db.$disconnect();
});

test("existing agents receive setup in dashboard and both room types without replacing accounts or history", async ({
  browser,
}) => {
  const account = await seed("routine_old");
  const other = await seed("routine_other");
  const owner = await seed("routine_owner", "OWNER");
  const room = await createRoom(account.id, "Existing routine conversation");
  await postMessage(room.id, account.id, {
    body: "History before ongoing-task setup.",
    clientMessageId: randomUUID(),
  });
  await consumeClaim(owner.id, (await issueClaim(account.id)).token);
  const page = await browser.newPage();
  await login(page, account.handle);
  await expect(
    page.getByRole("region", { name: "Ongoing visit setup" }),
  ).toContainText("Set up ongoing visits");
  await page.goto(`/rooms/${room.id}`);
  await expect(
    page.getByRole("region", { name: "Ongoing visit setup" }),
  ).toBeVisible();
  await expect(page.getByRole("log")).toContainText(
    "History before ongoing-task setup.",
  );
  await page.goto("/public-room");
  await page
    .getByRole("link", { name: "Set up ongoing visits", exact: true })
    .click();
  await expect(page).toHaveURL(/\/agent-setup$/);
  await expect(page.getByTestId("host-instructions")).toContainText(
    `for @${account.handle}`,
  );
  await expect(page.getByTestId("host-instructions")).toContainText(
    "Ask only for the required approval",
  );
  await page
    .getByLabel("Your agent host", { exact: true })
    .selectOption("MUSE");
  await page
    .getByLabel("Setup result", { exact: true })
    .selectOption("REPORTED_READY");
  await page.getByRole("button", { name: "Save host setup report" }).click();
  await expect(
    page.getByRole("region", { name: "Report host setup" }).getByRole("alert"),
  ).toContainText("Add the task name or ID");
  await expect(page.getByLabel("Your agent host", { exact: true })).toHaveValue(
    "MUSE",
  );
  await page
    .getByLabel("Setup result", { exact: true })
    .selectOption("NEEDS_APPROVAL");
  await page.getByRole("button", { name: "Save host setup report" }).click();
  await expect(
    page.getByRole("region", { name: "Your ongoing visit status" }),
  ).toContainText("Host approval needed");
  await expect(
    page.getByRole("button", { name: "Record check-in" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Setup result", { exact: true })
    .selectOption("REPORTED_READY");
  await page
    .getByLabel("Confirmed task name or ID", { exact: true })
    .fill("Minglo conversation check: confirmed host task");
  await page
    .getByLabel("Actual check interval (minutes)", { exact: true })
    .fill("15");
  await page
    .getByRole("button", { name: "Save host setup report" })
    .evaluate((button) => {
      const form = (button as HTMLButtonElement).form!;
      for (const [name, value] of [
        ["agentId", "forged"],
        ["setupVersion", "99"],
        ["lastCheckAt", "2099-01-01"],
      ]) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.append(input);
      }
    });
  await page.getByRole("button", { name: "Save host setup report" }).click();
  const status = page.getByRole("region", {
    name: "Your ongoing visit status",
  });
  await expect(status).toContainText("Host task reported");
  await expect(status).toContainText("Last check-in: not recorded");
  const routine = await db.agentRoutine.findUniqueOrThrow({
    where: { agentId: account.agent!.id },
  });
  expect(routine.intervalMinutes).toBe(15);
  expect(routine.host).toBe("MUSE");
  await expect(page.getByLabel("Setup result", { exact: true })).toHaveValue(
    "REPORTED_READY",
  );
  expect(routine.setupVersion).toBe(ROUTINE_SETUP_VERSION);
  expect(routine.lastCheckAt).toBeNull();
  expect(
    await db.agentRoutine.count({ where: { agentId: other.agent!.id } }),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Record check-in", exact: true })
    .click();
  await expect(status.locator("time")).toHaveCount(1);
  await expect
    .poll(
      async () =>
        (
          await db.agentRoutine.findUniqueOrThrow({
            where: { agentId: account.agent!.id },
          })
        ).lastCheckAt,
    )
    .not.toBeNull();
  const watch = await browser.newPage();
  await login(watch, owner.handle);
  await watch.goto("/agent-setup");
  await expect(
    watch.getByText(`@${account.handle}`, { exact: true }),
  ).toBeVisible();
  await expect(
    watch.getByText("Host task reported", { exact: true }),
  ).toBeVisible();
  await expect(
    watch.getByRole("button", { name: "Save host setup report" }),
  ).toHaveCount(0);
  await expect(
    watch.getByRole("button", { name: "Record check-in" }),
  ).toHaveCount(0);
  const unrelated = await browser.newPage();
  await login(unrelated, other.handle);
  await unrelated.goto("/agent-setup");
  await expect(unrelated.locator("body")).not.toContainText(
    "Minglo conversation check: confirmed host task",
  );
  const fresh = await browser.newPage();
  await login(fresh, account.handle);
  await fresh.goto("/agent-setup");
  await expect(
    fresh
      .getByRole("region", { name: "Your ongoing visit status" })
      .locator("time"),
  ).toHaveCount(1);
  await fresh.setViewportSize({ width: 390, height: 844 });
  expect(
    await fresh.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await fresh.screenshot({
    path: "test-results/ongoing-visits-mobile.png",
    fullPage: true,
  });
  await page.screenshot({
    path: "test-results/ongoing-visits-desktop.png",
    fullPage: true,
  });
  const same = await db.account.findUniqueOrThrow({
    where: { handle: account.handle },
    include: { agent: true },
  });
  expect(same.id).toBe(account.id);
  expect(same.createdAt).toEqual(account.createdAt);
  expect(same.agent!.ownerId).not.toBeNull();
  expect(await db.message.count({ where: { roomId: room.id } })).toBe(1);
  await Promise.all([
    page.close(),
    watch.close(),
    unrelated.close(),
    fresh.close(),
  ]);
});

test("new agents discover setup and sign-in preserves the setup destination", async ({
  browser,
}) => {
  const guest = await browser.newPage();
  await guest.goto("/for-agents");
  await expect(
    guest.getByRole("heading", { name: "Join once. Arrange your next visit." }),
  ).toBeVisible();
  await guest.getByRole("link", { name: "Open ongoing visit setup" }).click();
  await expect(guest).toHaveURL(/\/login\?next=%2Fagent-setup/);
  await guest
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await expect(guest).toHaveURL(/\/register\?next=%2Fagent-setup/);
  const account = await seed("routine_return");
  await guest.goto("/login?next=%2Fagent-setup");
  await guest.getByLabel("Handle", { exact: true }).fill(account.handle);
  await guest.getByLabel("Password", { exact: true }).fill(password);
  await guest.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(guest).toHaveURL(/\/agent-setup$/);
  const fresh = await browser.newPage();
  await register(fresh, `routine_new_${suffix}`, "AGENT");
  await expect(
    fresh.getByRole("region", { name: "Ongoing visit setup" }),
  ).toBeVisible();
  expect(safeNext("/agent-setup")).toBe("/agent-setup");
  expect(safeNext("//other.example/agent-setup")).toBe("/dashboard");
  expect(safeNext("/agent-setup?next=https://other.example")).toBe(
    "/dashboard",
  );
  await guest.close();
  await fresh.close();
});

test("reports validate ownership, schedule evidence, pause, and unsupported hosts without fabricating check-ins", async () => {
  const agent = await seed("routine_states");
  const owner = await seed("routine_noagent", "OWNER");
  const input = {
    host: "DOT",
    status: "REPORTED_READY",
    intervalMinutes: 5,
    taskReference: "host-task-123",
  };
  await expect(saveRoutineReport(owner.id, input)).rejects.toThrow(
    /Only an agent/,
  );
  await expect(recordRoutineCheck(owner.id)).rejects.toThrow(
    /Report a confirmed/,
  );
  await expect(recordRoutineCheck(agent.id)).rejects.toThrow(
    /Report a confirmed/,
  );
  for (const invalid of [
    { ...input, host: "INVALID" },
    { ...input, status: "VERIFIED" },
    { ...input, intervalMinutes: 0 },
    { ...input, intervalMinutes: 1441 },
    { ...input, taskReference: " " },
    { ...input, taskReference: "x".repeat(201) },
  ]) {
    await expect(saveRoutineReport(agent.id, invalid)).rejects.toThrow();
  }
  await saveRoutineReport(agent.id, input);
  await recordRoutineCheck(agent.id);
  expect(
    (
      await db.agentRoutine.findUniqueOrThrow({
        where: { agentId: agent.agent!.id },
      })
    ).lastCheckAt,
  ).not.toBeNull();
  await saveRoutineReport(agent.id, { ...input, status: "PAUSED" });
  await expect(recordRoutineCheck(agent.id)).rejects.toThrow(
    /Report a confirmed/,
  );
  await saveRoutineReport(agent.id, {
    ...input,
    status: "UNAVAILABLE",
    taskReference: "",
  });
  const unavailable = await db.agentRoutine.findUniqueOrThrow({
    where: { agentId: agent.agent!.id },
  });
  expect(unavailable.reportedAt).toBeNull();
  expect(unavailable.lastCheckAt).toBeNull();
  await saveRoutineReport(agent.id, input);
  await db.agentRoutine.update({
    where: { agentId: agent.agent!.id },
    data: { setupVersion: 0 },
  });
  await expect(recordRoutineCheck(agent.id)).rejects.toThrow(
    /Report a confirmed/,
  );
  const instruction = routineInstructions(
    "https://minglo.example",
    agent.handle,
  );
  expect(instruction).toContain("https://minglo.example/agent-setup");
  expect(instruction).toContain("If approval is pending, reuse that request");
  expect(instruction).toContain(
    "Required host approvals and limits still apply",
  );
  expect(ownerStarter("https://minglo.example")).toContain(
    "existing Agent account",
  );
});

test("routine forms reject cross-site and unauthenticated setup mutations", async ({
  browser,
}) => {
  const account = await seed("routine_guard");
  const page = await browser.newPage();
  await login(page, account.handle);
  for (const mode of ["cross-site", "no-session"]) {
    await page.goto("/agent-setup");
    await page.route("**/agent-setup", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const headers = { ...route.request().headers() };
      if (mode === "cross-site") headers.origin = "https://other.example";
      else headers.cookie = "";
      const response = await route.fetch({ headers, maxRedirects: 0 });
      if (mode === "no-session")
        expect(response.headers()["x-action-redirect"]).toContain("/login");
      await route.fulfill({ response });
    });
    const rejected = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/agent-setup",
    );
    await page.getByRole("button", { name: "Save host setup report" }).click();
    const response = await rejected;
    if (mode === "cross-site")
      expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(
      await db.agentRoutine.count({ where: { agentId: account.agent!.id } }),
    ).toBe(0);
    await page.unroute("**/agent-setup");
  }
  await page.close();
});
