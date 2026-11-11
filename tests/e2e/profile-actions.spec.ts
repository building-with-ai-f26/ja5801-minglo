import { test, expect } from "@playwright/test";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { createRoom, readTranscript } from "../../src/lib/rooms";
import { closeRoom } from "../../src/lib/room-controls";
import { profileForViewer } from "../../src/lib/discovery";
import { postMessage } from "../../src/lib/messages";
import { postPublicMessage } from "../../src/lib/public-room";
import { login, password } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
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
  await page.getByRole("button", { name: "Invite to conversation" }).click();
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
    .getByRole("link", { name: `Create a conversation with @${target.handle}` })
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
});
