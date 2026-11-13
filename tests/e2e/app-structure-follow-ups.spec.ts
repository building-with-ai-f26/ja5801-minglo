import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { consumeClaim, issueClaim } from "../../src/lib/claims";
import {
  structureAccount as account,
  structureChat as chat,
} from "./app-structure-fixtures";
import { login } from "./helpers";

test.afterAll(() => db.$disconnect());

for (const state of ["pending-only", "active-only", "mixed"] as const) {
  test(`Home aggregate links reach ${state} observed conversations`, async ({
    page,
  }, info) => {
    const owner = await account();
    const agent = await account("AGENT", "Connected agent");
    await consumeClaim(owner.id, (await issueClaim(agent.id)).token);
    const pending =
      state === "active-only"
        ? null
        : await chat(
            agent.id,
            (await account()).id,
            "Pending observed introduction",
          );
    const active =
      state === "pending-only"
        ? null
        : await chat(
            agent.id,
            (await account()).id,
            "Active observed exchange",
            "ACTIVE",
          );
    const outgoing = await chat(
      owner.id,
      (await account()).id,
      "Personal outgoing introduction",
    );
    await login(page, owner.handle);
    const group = page.getByRole("region", {
      name: "Your agents’ direct chats",
      exact: true,
    });
    await expect(group).toContainText("Read only");
    for (const c of [pending, active].filter((c) => c !== null))
      await expect(group.locator(`a[href="/messages/${c.id}"]`)).toBeVisible();
    await expect(
      group.getByRole("link", { name: "View requests", exact: true }),
    ).toHaveCount(pending ? 1 : 0);
    await expect(
      group.getByRole("link", { name: "View chats", exact: true }),
    ).toHaveCount(active ? 1 : 0);
    const personal = page.getByRole("region", {
      name: "Your direct chats",
      exact: true,
    });
    await expect(
      personal.getByRole("link", { name: "View chats", exact: true }),
    ).toHaveAttribute("href", "/inbox");
    await expect(
      personal.locator(`a[href="/messages/${outgoing.id}"]`),
    ).toBeVisible();
    if (state === "mixed") {
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => {
          localStorage.setItem("minglo-theme", value);
          document.documentElement.dataset.theme = value;
        }, theme);
        for (const width of [320, 360, 768, 1440]) {
          await page.setViewportSize({ width, height: 960 });
          await page.evaluate(() => document.fonts.ready);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: info.outputPath(`home-mixed-${width}-${theme}.png`),
            fullPage: true,
          });
        }
      }
    }
    for (const [label, conversation, destination] of [
      ["View requests", pending, "/inbox?view=requests"],
      ["View chats", active, "/inbox"],
    ] as const) {
      if (!conversation) continue;
      await page.goto("/dashboard");
      await group.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(destination);
      await expect(
        page.getByRole("heading", { level: 1, name: "Messages", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(`a[href="/messages/${conversation.id}"]`),
      ).toBeVisible();
    }
    expect(
      await db.readPosition.count({
        where: { accountId: { in: [owner.id, agent.id] } },
      }),
    ).toBe(0);
  });
}

for (const role of ["OWNER", "AGENT"] as const) {
  test(`Public chat room title stays readable for ${role} with audience and unread badges`, async ({
    page,
  }, info) => {
    const viewer = await account(role);
    await db.publicMessage.create({
      data: {
        senderAccountId: (await account()).id,
        body: "A public unread fixture",
        clientMessageId: randomUUID(),
      },
    });
    await login(page, viewer.handle);
    await page.goto("/conversations");
    const card = page
      .getByRole("region", { name: "Shared conversation" })
      .getByRole("link");
    await expect(card).toContainText("All signed-in accounts");
    await expect(card).toContainText("unread");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        localStorage.setItem("minglo-theme", value);
        document.documentElement.dataset.theme = value;
      }, theme);
      for (const width of [320, 360, 768, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        await page.evaluate(() => document.fonts.ready);
        const words = await card
          .getByRole("heading", { name: "Public chat" })
          .evaluate((el) => {
            const text = el.firstChild!;
            return [...text.textContent!.matchAll(/\S+/g)].map((match) => {
              const range = document.createRange();
              range.setStart(text, match.index!);
              range.setEnd(text, match.index! + match[0].length);
              return {
                word: match[0],
                lines: new Set(
                  [...range.getClientRects()].map((r) => Math.round(r.top)),
                ).size,
              };
            });
          });
        for (const word of words)
          expect(
            word.lines,
            `${width}px ${theme}: ${word.word} stays whole`,
          ).toBe(1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`rooms-${role}-${width}-${theme}.png`),
          fullPage: true,
        });
      }
    }
  });
}
