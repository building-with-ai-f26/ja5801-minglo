import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { createRoom, readTranscript } from "../../src/lib/rooms";
import { closeRoom } from "../../src/lib/room-controls";
import { profileForViewer, searchAccounts } from "../../src/lib/discovery";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import { login, password } from "./helpers";
import { safeNext } from "../../src/lib/validation";
import { setBlocked } from "../../src/lib/blocks";

test.afterAll(async () => {
  await db.$disconnect();
});

test("human profiles save only the signed-in identity and expose searchable, escaped public fields", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const handle = `human_profile_${suffix}`;
  const passwordHash = await hash(password);
  const target = await db.account.create({
    data: {
      handle: `human_target_${suffix}`,
      type: "AGENT",
      passwordHash,
      agent: {
        create: { displayName: "Protected agent", interests: "Gardening" },
      },
    },
    include: { agent: true },
  });
  const other = await db.account.create({
    data: {
      handle: `human_other_${suffix}`,
      type: "OWNER",
      passwordHash,
      owner: { create: { displayName: "Unchanged person" } },
    },
    include: { owner: true },
  });
  expect(other.owner).toMatchObject({ bio: "", interests: "" });
  const account = await db.account.create({
    data: {
      handle,
      type: "OWNER",
      passwordHash,
      owner: { create: { displayName: "Human reader" } },
    },
  });
  await login(page, handle);
  await page.goto(`/profiles/${handle}`);
  await expect(
    page.getByText("No introduction added yet.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("About you", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No agents claimed yet.", exact: true }),
  ).toBeVisible();
  const bio = `<script>window.profileInjected=true</script> I study plants_${suffix}.`;
  await page
    .getByLabel("Display name", { exact: true })
    .fill("A gardening person");
  await page.getByLabel("About you", { exact: true }).fill(bio);
  await page
    .getByLabel("Interests", { exact: true })
    .fill(`Gardening, soil_${suffix}`);
  await page.locator(".owner-profile-editor form").evaluate(
    (form, ids) => {
      for (const [name, value] of Object.entries(ids)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.append(input);
      }
    },
    { accountId: target.id, ownerId: other.owner!.id, type: "AGENT" },
  );
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  expect(
    await db.owner.findUniqueOrThrow({ where: { accountId: account.id } }),
  ).toMatchObject({
    displayName: "A gardening person",
    bio,
    interests: `Gardening, soil_${suffix}`,
  });
  expect(
    await db.agent.findUniqueOrThrow({ where: { accountId: target.id } }),
  ).toMatchObject({
    displayName: "Protected agent",
    bio: "",
    interests: "Gardening",
  });
  expect(
    await db.owner.findUniqueOrThrow({ where: { accountId: other.id } }),
  ).toMatchObject({ displayName: "Unchanged person", bio: "", interests: "" });
  for (const q of [`plants_${suffix}`, `soil_${suffix}`])
    expect(
      (await searchAccounts(target.id, { q, type: "OWNER" })).accounts.map(
        (a) => a.id,
      ),
    ).toContain(account.id);
  const projection = await profileForViewer(target.id, handle);
  expect(JSON.stringify(projection)).not.toMatch(
    /passwordHash|ownerId|sessionVersion|agents|recovery/,
  );
  await page.goto(`/profiles/${handle}`);
  await expect(
    page.getByRole("region", { name: "Public profile", exact: true }),
  ).toContainText(bio);
  expect(
    await page.evaluate(() => window.hasOwnProperty("profileInjected")),
  ).toBe(false);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/profiles/${target.handle}`);
  await expect(
    page.getByText("Shared interests: Gardening", { exact: true }),
  ).toBeVisible();
  await page.goto("/profile?edit=1");
  await page
    .getByLabel("About you", { exact: true })
    .evaluate((el) => el.removeAttribute("maxlength"));
  await page.getByLabel("About you", { exact: true }).fill("x".repeat(501));
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    (await db.owner.findUniqueOrThrow({ where: { accountId: account.id } }))
      .bio,
  ).toBe(bio);
});
test("profiles show safe public context and carry a target into an authorized invitation", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const accounts = await Promise.all(
    ["viewer", "target"].map(async (label) =>
      db.account.create({
        data: {
          handle: `profile_${label}_${suffix}`,
          type: "AGENT",
          passwordHash: await hash(password),
          agent: {
            create: {
              displayName: `Profile ${label}`,
              bio: "Interested in conversation",
              interests:
                label === "viewer" ? "Music, design" : "music, philosophy",
            },
          },
        },
        include: { agent: true },
      }),
    ),
  );
  const [viewer, target] = accounts;
  const available = await createRoom(viewer.id, "An available discussion");
  const closed = await createRoom(viewer.id, "Closed discussion");
  await closeRoom(viewer.id, closed.id);
  const privateRoom = await createRoom(target.id, "Private target room");
  await postMessage(privateRoom.id, target.id, {
    body: "Private words stay private",
    clientMessageId: randomUUID(),
  });
  await postPublicMessage(target.id, {
    body: "A public thought about music",
    clientMessageId: randomUUID(),
  });
  const projection = await profileForViewer(viewer.id, target.handle);
  expect(JSON.stringify(projection)).not.toMatch(
    /passwordHash|ownerId|Private words|participationPaused/,
  );
  await login(page, viewer.handle);
  await page.goto(`/profiles/${target.handle}`);
  await expect(page.getByText("Shared interests: music")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Recent public contributions" }),
  ).toContainText("A public thought about music");
  await expect(page.locator("body")).not.toContainText(
    "Private words stay private",
  );
  expect(
    await page
      .getByLabel("Your conversation")
      .locator("option")
      .allTextContents(),
  ).toEqual([available.title]);
  await page.getByRole("button", { name: "Invite to agent room" }).click();
  await expect
    .poll(async () =>
      db.membership.count({
        where: {
          roomId: available.id,
          agentId: target.agent!.id,
          status: "INVITED",
        },
      }),
    )
    .toBe(1);
  expect(await readTranscript(available.id, target.id)).toBeNull();
  await page
    .getByRole("link", { name: `Create agent room with @${target.handle}` })
    .click();
  await expect(page.getByLabel("Room name")).toHaveValue(
    "Conversation with Profile target",
  );
  await page.getByRole("button", { name: "Create private room" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/rooms/.+\\?handle=${target.handle}`),
  );
  await expect(
    page.getByRole("button", { name: "Send invitation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Already invited or admitted")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await setBlocked(target.id, viewer.id, true);
  await page.goto(`/profiles/${target.handle}`);
  await expect(
    page.getByText(
      "New agent-room invitations are unavailable due to account preferences.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: `Create agent room with @${target.handle}`,
    }),
  ).toHaveCount(0);
});

test("chat authors open safe profiles, including polled messages and a sign-in continuation", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const passwordHash = await hash(password);
  const person = await db.account.create({
    data: {
      handle: `author_person_${suffix}`,
      type: "OWNER",
      passwordHash,
      owner: { create: { displayName: "A human author" } },
    },
  });
  const agent = await db.account.create({
    data: {
      handle: `author_agent_${suffix}`,
      type: "AGENT",
      passwordHash,
      agent: { create: { displayName: "An agent author" } },
    },
  });
  const message = await postPublicMessage(person.id, {
    body: "A public introduction",
    clientMessageId: randomUUID(),
  });
  await page.goto(`/profiles/${person.handle}`);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Handle", { exact: true }).fill(agent.handle);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`/profiles/${person.handle}`);
  await expect(
    page
      .getByRole("region", { name: "Public profile", exact: true })
      .getByText("Person", { exact: true }),
  ).toBeVisible();
  await page.goto("/public-room");
  const row = page.locator(`[data-message-id="${message.id}"]`);
  await row
    .getByRole("link", { name: `View @${person.handle}'s profile` })
    .click();
  await expect(
    page.getByRole("heading", { name: "A human author", exact: true }),
  ).toBeVisible();
  await page.goto("/public-room");
  const polled = await postPublicMessage(agent.id, {
    body: "A new contribution after loading",
    clientMessageId: randomUUID(),
  });
  const ownRow = page.locator(`[data-message-id="${polled.id}"]`);
  await expect(
    ownRow.getByRole("link", {
      name: `An agent author @${agent.handle}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    ownRow.getByRole("link", { name: `Link to message ${polled.id}` }),
  ).toBeVisible();
  await expect(
    ownRow.getByRole("button", { name: `Reply to message ${polled.id}` }),
  ).toBeVisible();
  await ownRow
    .getByRole("link", {
      name: `An agent author @${agent.handle}`,
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Public profile", exact: true })
      .getByText("Agent", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit profile", exact: true }),
  ).toBeVisible();
  const room = await createRoom(agent.id, "A private author link");
  const privateMessage = await postMessage(room.id, agent.id, {
    body: "Private words",
    clientMessageId: randomUUID(),
  });
  await page.goto(`/rooms/${room.id}`);
  await page
    .locator(`[data-message-id="${privateMessage.id}"]`)
    .getByRole("link", { name: `View @${agent.handle}'s profile` })
    .click();
  await expect(
    page.getByRole("region", {
      name: "Recent public contributions",
      exact: true,
    }),
  ).not.toContainText("Private words");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/profiles/missing_${suffix}`);
  await expect(
    page.getByRole("heading", { name: "Nothing to see here.", exact: true }),
  ).toBeVisible();
  expect(safeNext(`/profiles/${person.handle}`)).toBe(
    `/profiles/${person.handle}`,
  );
  for (const value of [
    "//evil.example",
    "/profiles/abc?next=https://evil.example",
    "/profiles/%2f%2fevil.example",
    "https://evil.example/profiles/abc",
  ])
    expect(safeNext(value)).toBe("/dashboard");
});
