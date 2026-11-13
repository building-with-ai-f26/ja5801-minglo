import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { createTopic, createDiscussion, readTopic } from "../../src/lib/topics";
import { allowAttempt } from "../../src/lib/rate-limit";
import { setParticipationPaused } from "../../src/lib/participation";
import { login, password } from "./helpers";

test.describe.configure({ timeout: 90_000 });

async function seed(type: "OWNER" | "AGENT" = "OWNER") {
  const handle = `tc_${randomUUID().replaceAll("-", "").slice(0, 22)}`;
  return db.account.create({
    data: {
      handle,
      type,
      passwordHash: await hash(password),
      ...(type === "AGENT"
        ? { agent: { create: { displayName: handle } } }
        : { owner: { create: { displayName: handle } } }),
    },
    include: { agent: true },
  });
}
const input = (name = `Shared interest ${randomUUID()}`) => ({
  name,
  description: "Discuss a useful shared interest.",
  rules: "Respect privacy.",
  clientCreationId: randomUUID(),
});
test.afterAll(() => db.$disconnect());

test("topic creation attributes both roles, deduplicates concurrent retries and rejects changed retry intent", async () => {
  for (const role of ["OWNER", "AGENT"] as const) {
    const a = await seed(role),
      data = input();
    const results = await Promise.all([
      createTopic(a.id, data),
      createTopic(a.id, data),
    ]);
    expect(results[0]).toEqual(results[1]);
    const stored = await db.topic.findUniqueOrThrow({
      where: { id: results[0].id },
      include: { _count: { select: { threads: true, follows: true } } },
    });
    expect(stored.creatorAccountId).toBe(a.id);
    expect(stored.clientCreationId).toBe(data.clientCreationId);
    expect(stored._count).toEqual({ threads: 0, follows: 0 });
    await expect(
      createTopic(a.id, { ...data, description: "Changed intent" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await db.topicModerationAction.count({ where: { targetId: stored.id } }),
    ).toBe(0);
  }
});

test("duplicate names, validation and quotas fail atomically; successful retries do not charge again", async () => {
  const a = await seed(),
    b = await seed();
  const first = input(`Shared project ${randomUUID()}`);
  const topic = await createTopic(a.id, first);
  await expect(
    createTopic(b.id, { ...input(), name: `  ${first.name.toUpperCase()}  ` }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    createTopic(b.id, { ...input(), name: " " }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    createTopic(b.id, { ...input(), description: " " }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    createTopic(b.id, { ...input(), rules: "x".repeat(2001) }),
  ).rejects.toMatchObject({ status: 400 });
  for (let i = 0; i < 3; i++) await createTopic(b.id, input());
  await expect(createTopic(b.id, input())).rejects.toMatchObject({
    status: 429,
  });
  for (let i = 0; i < 2; i++) await createTopic(a.id, input());
  expect(await createTopic(a.id, first)).toEqual(topic);
  await expect(createTopic(a.id, input())).rejects.toMatchObject({
    status: 429,
  });
  expect(await db.topic.count({ where: { creatorAccountId: b.id } })).toBe(3);
  // Public message limits also constrain topic creation; a failed write does not consume the daily allowance.
  const limited = await seed();
  for (let i = 0; i < 30; i++)
    await allowAttempt("public-post", limited.id, 30);
  const before = await db.rateLimit.count();
  await expect(createTopic(limited.id, input())).rejects.toMatchObject({
    status: 429,
  });
  expect(await db.rateLimit.count()).toBe(before);
  expect(
    await db.topic.count({ where: { creatorAccountId: limited.id } }),
  ).toBe(0);
});

test("paused agents and unknown accounts cannot create; generated links support international and reserved names", async () => {
  const a = await seed("AGENT");
  await setParticipationPaused(a.id, a.agent!.id, true);
  await expect(createTopic(a.id, input())).rejects.toMatchObject({
    status: 403,
  });
  await expect(
    createTopic("c000000000000000000000000", input()),
  ).rejects.toMatchObject({ status: 401 });
  await setParticipationPaused(a.id, a.agent!.id, false);
  for (const name of ["New", "学びと研究", "日常のこと"]) {
    const topic = await createTopic(a.id, input(name));
    expect(topic.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(topic.slug).not.toBe("new");
    expect((await readTopic(a.id, topic.slug))?.name).toBe(name);
  }
});

for (const role of ["OWNER", "AGENT"] as const) {
  test(`${role} can create from discovery and start a discussion; duplicate errors preserve drafts`, async ({
    page,
  }) => {
    const a = await seed(role);
    const existing = await createTopic((await seed()).id, input());
    const t = await db.topic.findUniqueOrThrow({ where: { id: existing.id } });
    await login(page, a.handle);
    await page.goto(role === "OWNER" ? "/topics" : "/discover?view=topics");
    await page.getByRole("link", { name: "Create topic", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Create a topic.", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Topic name", { exact: true }).fill(t.name);
    await page
      .getByLabel("What is this topic for?", { exact: true })
      .fill("A shared purpose with enough context.");
    await page
      .getByLabel("Topic rules (optional)", { exact: true })
      .fill("Be curious and respect privacy.");
    await page
      .getByRole("button", { name: "Create topic", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "already exists",
    );
    await expect(
      page.getByLabel("What is this topic for?", { exact: true }),
    ).toHaveValue("A shared purpose with enough context.");
    await expect(
      page.getByLabel("Topic rules (optional)", { exact: true }),
    ).toHaveValue("Be curious and respect privacy.");
    const name = `Creative projects ${randomUUID()}`;
    await page.getByLabel("Topic name", { exact: true }).fill(name);
    await page
      .getByRole("button", { name: "Create topic", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    const created = await db.topic.findFirstOrThrow({ where: { name } });
    expect(created.creatorAccountId).toBe(a.id);
    await page
      .getByRole("link", { name: "Start discussion", exact: true })
      .click();
    await expect(
      page.getByLabel("Discussion title", { exact: true }),
    ).toBeVisible();
    await createDiscussion(a.id, created.id, {
      title: "A first useful question",
      body: "What would you like to make?",
      clientCreationId: randomUUID(),
    });
    const other = await seed();
    expect((await readTopic(other.id, created.slug))?.name).toBe(name);
  });
}

test("new topic page preserves sign-in destination and rechecks a pause applied after render", async ({
  page,
}) => {
  await page.goto("/topics/new");
  await expect(
    page.getByRole("heading", { name: "Good to have you back." }),
  ).toBeVisible();
  await expect(page.locator('input[name="next"]')).toHaveValue("/topics/new");
  const a = await seed("AGENT");
  await login(page, a.handle);
  await page.goto("/topics/new");
  await page.getByLabel("Topic name", { exact: true }).fill("Paused topic");
  await page
    .getByLabel("What is this topic for?", { exact: true })
    .fill("Must not be created.");
  await setParticipationPaused(a.id, a.agent!.id, true);
  await page.getByRole("button", { name: "Create topic", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("paused");
  expect(await db.topic.count({ where: { creatorAccountId: a.id } })).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Review Participation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create topic", exact: true }),
  ).toHaveCount(0);
});
