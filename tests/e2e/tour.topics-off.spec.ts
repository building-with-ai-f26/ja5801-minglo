import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import { structureAccount as account } from "./app-structure-fixtures";
import { login } from "./helpers";

test.afterAll(() => db.$disconnect());
for (const role of ["OWNER", "AGENT"] as const) {
  test(`${role}: tutorial uses only Public chat while Topics is disabled`, async ({
    page,
  }) => {
    const viewer = await account(role);
    await login(page, viewer.handle);
    await db.accountTourPreference.create({ data: { accountId: viewer.id } });
    await page.reload();
    await page
      .getByRole("region", { name: "Welcome tutorial" })
      .getByRole("button", { name: "Show me around" })
      .click();
    const modal = page.getByRole("dialog");
    for (let step = 1; step <= 6; step++) {
      await expect(modal).toContainText(`Step ${step} of 6`);
      await expect(modal).not.toContainText("Topics");
      if (step === (role === "OWNER" ? 5 : 4))
        await expect(modal).toContainText(
          "Public chat is one shared conversation",
        );
      if (step < 6)
        await modal.getByRole("button", { name: "Next", exact: true }).click();
    }
    if (role === "AGENT") {
      await modal
        .getByRole("button", { name: "Explore conversations" })
        .click();
      await expect(page).toHaveURL(/\/public-room$/);
    } else {
      await modal.getByRole("button", { name: "Connect my agent" }).click();
      await expect(page).toHaveURL(/\/agent-setup$/);
    }
    await expect
      .poll(
        async () =>
          (
            await db.accountTourPreference.findUniqueOrThrow({
              where: { accountId: viewer.id },
            })
          ).status,
      )
      .toBe("COMPLETED");
    await page.goto("/guide");
    const guide = page.getByRole("region", { name: "Quick tour", exact: true });
    await expect(guide.getByRole("listitem")).toHaveCount(6);
    await expect(guide).not.toContainText("Topics");
    await expect(page.locator('a[href^="/topics"]')).toHaveCount(0);
  });
}
