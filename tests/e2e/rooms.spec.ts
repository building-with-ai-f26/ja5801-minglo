import { test, expect } from "@playwright/test";
import { register } from "./helpers";
import { db } from "../../src/lib/db";
import {
  createRoom,
  inviteAgent,
  respondToInvitation,
  roomForAccount,
} from "../../src/lib/rooms";
const suffix = Date.now().toString(36);
test.afterAll(async () => {
  await db.$disconnect();
});

test("Next.js form actions reject a cross-site room creation request", async ({
  page,
}) => {
  const handle = `csrf_owner_${suffix}`;
  await register(page, handle, "OWNER");
  await page.goto("/rooms/new");
  await page.route("**/rooms/new", async (route) => {
    // Browsers restore their own Origin when continuing a request. Send this
    // deliberate forged request through Playwright's HTTP transport instead.
    const response = await route.fetch({
      headers: {
        ...route.request().headers(),
        origin: "https://other.example",
      },
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  });
  await page.getByLabel("Room name").fill("This must never be created");
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/rooms/new",
  );
  await page.getByRole("button", { name: "Create private room" }).click();
  expect((await response).status()).toBeGreaterThanOrEqual(400);
  expect(
    await db.room.count({ where: { title: "This must never be created" } }),
  ).toBe(0);
});

test("owner creates a private room, searches an exact agent handle, and agent accepts; outsiders cannot read", async ({
  browser,
}) => {
  const owner = await browser.newPage();
  const agent = await browser.newPage();
  const outsider = await browser.newPage();
  const handle = `room_agent_${suffix}`;
  await register(owner, `room_owner_${suffix}`, "OWNER");
  await register(agent, handle, "AGENT", "Milo");
  await register(outsider, `outsider_${suffix}`, "AGENT");
  await owner.goto("/rooms/new");
  await owner.getByLabel("Room name").fill("Our quiet corner");
  await owner.getByRole("button", { name: "Create private room" }).click();
  await expect(
    owner.getByRole("heading", { name: "Our quiet corner" }),
  ).toBeVisible();
  const roomUrl = owner.url();
  const roomId = new URL(roomUrl).pathname.split("/").pop();
  await owner.getByLabel("Agent handle").fill(handle.toUpperCase());
  await owner.getByRole("button", { name: "Find agent" }).click();
  await expect(
    owner.getByRole("button", { name: "Send invitation" }),
  ).toBeVisible();
  await owner.getByRole("button", { name: "Send invitation" }).click();
  await expect(owner.getByText("Already invited or admitted")).toBeVisible();
  // Even an invited agent cannot read before accepting.
  await agent.goto(roomUrl);
  await expect(
    agent.getByRole("heading", { name: "Nothing to see here." }),
  ).toBeVisible();
  expect(
    (await agent.request.get(`/api/rooms/${roomId}/messages`)).status(),
  ).toBe(404);
  await agent.goto("/dashboard");
  await agent.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    agent.getByRole("link", { name: /Our quiet corner/ }),
  ).toBeVisible();
  await agent.getByRole("link", { name: /Our quiet corner/ }).click();
  await expect(
    agent.getByRole("heading", { name: "Our quiet corner" }),
  ).toBeVisible();
  await outsider.goto(roomUrl);
  await expect(
    outsider.getByRole("heading", { name: "Nothing to see here." }),
  ).toBeVisible();
  expect(
    (await outsider.request.get(`/api/rooms/${roomId}/messages`)).status(),
  ).toBe(404);
  const signedOut = await browser.newContext();
  expect(
    (await signedOut.request.get(`/api/rooms/${roomId}/messages`)).status(),
  ).toBe(401);
  const ownerRead = await owner.request.get(`/api/rooms/${roomId}/messages`);
  expect(ownerRead.status()).toBe(200);
  expect(ownerRead.headers()["cache-control"]).toContain("no-store");
  await owner.close();
  await agent.close();
  await outsider.close();
  await signedOut.close();
});

test("agent creator joins automatically; group invitations, decline/reinvite, and permissions are atomic", async () => {
  const agents = await Promise.all(
    [0, 1, 2].map((i) =>
      db.account.create({
        data: {
          handle: `group_${i}_${suffix}`,
          passwordHash: "not-a-login-hash",
          type: "AGENT",
          agent: { create: { displayName: `Group ${i}` } },
        },
        include: { agent: true },
      }),
    ),
  );
  const room = await createRoom(agents[0].id, "A group conversation");
  const creatorMembership = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: agents[0].agent!.id },
  });
  expect(creatorMembership.status).toBe("ACCEPTED");
  await Promise.all([
    inviteAgent(agents[0].id, room.id, agents[1].handle),
    inviteAgent(agents[0].id, room.id, agents[1].handle),
    inviteAgent(agents[0].id, room.id, agents[2].handle),
  ]);
  expect(await db.membership.count({ where: { roomId: room.id } })).toBe(3);
  const invitation = await db.membership.findFirstOrThrow({
    where: { roomId: room.id, agentId: agents[1].agent!.id },
  });
  await expect(
    respondToInvitation(agents[2].id, invitation.id, true),
  ).rejects.toThrow(/another agent/);
  await respondToInvitation(agents[1].id, invitation.id, false);
  expect(await roomForAccount(room.id, agents[1].id)).toBeNull();
  await inviteAgent(agents[0].id, room.id, agents[1].handle);
  await respondToInvitation(agents[1].id, invitation.id, true);
  expect(await roomForAccount(room.id, agents[1].id)).not.toBeNull();
  await expect(
    inviteAgent(agents[1].id, room.id, agents[2].handle),
  ).rejects.toThrow(/creator/);
  await expect(
    respondToInvitation(agents[1].id, creatorMembership.id, false),
  ).rejects.toThrow();
  await inviteAgent(agents[0].id, room.id, agents[1].handle);
  expect(
    (await db.membership.findUniqueOrThrow({ where: { id: invitation.id } }))
      .status,
  ).toBe("ACCEPTED");
});
