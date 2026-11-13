import { expect, type Page, type TestInfo } from "@playwright/test";

export async function expectNavigationWordsIntact(page: Page) {
  const labels = await page
    .locator(".sidebar .side-nav a:visible")
    .evaluateAll((links) =>
      links.map((link) => {
        const label = link.querySelector("span")!;
        const text = label.firstChild!;
        const bounds = link.getBoundingClientRect();
        const words = [...(text.textContent ?? "").matchAll(/\S+/g)].map(
          (match) => {
            const range = document.createRange();
            range.setStart(text, match.index!);
            range.setEnd(text, match.index! + match[0].length);
            const rects = [...range.getClientRects()].filter(
              (rect) => rect.width > 0,
            );
            return {
              word: match[0],
              lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
              inside: rects.every(
                (rect) =>
                  rect.left >= bounds.left - 1 &&
                  rect.right <= bounds.right + 1 &&
                  rect.top >= bounds.top - 1 &&
                  rect.bottom <= bounds.bottom + 1,
              ),
            };
          },
        );
        return { label: label.textContent, words };
      }),
    );
  for (const label of labels)
    for (const word of label.words) {
      expect(
        word.lines,
        `${label.label}: word "${word.word}" must stay intact`,
      ).toBe(1);
      expect(
        word.inside,
        `${label.label}: word "${word.word}" must fit its target`,
      ).toBe(true);
    }
}

export async function checkStructureNavigation(
  page: Page,
  role: "OWNER" | "AGENT",
  topics: boolean,
  info: TestInfo,
) {
  const nav = page.getByRole("navigation", { name: "Workspace", exact: true });
  const expected = [
    "Home",
    ...(topics ? ["Topics"] : []),
    "Messages",
    "People & agents",
  ];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      localStorage.setItem("minglo-theme", value);
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [1440, 360, 320]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto("/dashboard");
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const label of expected)
        await expect(
          nav.getByRole("link", { name: label, exact: true }),
        ).toBeVisible();
      await expect(
        nav.getByRole("link", { name: "Home", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(nav.locator('a[href="/topics"]')).toHaveCount(
        topics ? 1 : 0,
      );
      if (width <= 360) {
        const links = nav.getByRole("link");
        expect(await links.allTextContents()).toEqual(expected);
        const columns = await nav.evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        );
        expect(columns, "no empty mobile navigation slot").toBe(
          expected.length,
        );
        for (const link of await links.all()) {
          const box = await link.boundingBox();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
      }
      const more = page.locator(".secondary-nav > summary");
      const details = page.locator(".secondary-nav");
      // Native details persists while this page is mounted; always begin closed.
      if ((await details.getAttribute("open")) !== null) await more.click();
      await expectNavigationWordsIntact(page);
      await page.screenshot({
        path: info.outputPath(
          `nav-${role}-${topics ? "on" : "off"}-${width}-${theme}-closed.png`,
        ),
        fullPage: true,
      });
      await more.focus();
      await expect(more).toBeFocused();
      const outline = await more.evaluate((el) => ({
        style: getComputedStyle(el).outlineStyle,
        width: getComputedStyle(el).outlineWidth,
      }));
      expect(outline.style).not.toBe("none");
      expect(parseFloat(outline.width)).toBeGreaterThan(0);
      await page.keyboard.press("Enter");
      await expect(details).toHaveAttribute("open", "");
      const menu = page.getByRole("navigation", {
        name: "More destinations and account",
        exact: true,
      });
      for (const label of [
        "Public chat",
        "Agent rooms",
        "My profile",
        "Account settings",
        "How it works",
      ])
        await expect(
          menu.getByRole("link", { name: label, exact: true }),
        ).toBeVisible();
      if (role === "OWNER")
        await expect(
          menu.getByRole("link", { name: "My agents", exact: true }),
        ).toBeVisible();
      else {
        await expect(page.locator('.sidebar a[href="/agents"]')).toHaveCount(0);
        await expect(
          menu.getByRole("link", { name: "Manage participation", exact: true }),
        ).toBeVisible();
      }
      if (width <= 360) {
        const visibleHrefs = await page
          .locator(".sidebar a:visible")
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute("href")),
          );
        expect(
          new Set(visibleHrefs).size,
          "no duplicate mobile destinations",
        ).toBe(visibleHrefs.length);
      }
      for (const item of [
        more,
        page.locator(".theme-toggle"),
        ...(await menu.getByRole("link").all()),
      ]) {
        const box = await item.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await expectNavigationWordsIntact(page);
      expect(
        await page
          .locator(".theme-toggle")
          .evaluate((el) => el.getBoundingClientRect().width),
      ).toBe(64);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(
          `nav-${role}-${topics ? "on" : "off"}-${width}-${theme}-open.png`,
        ),
        fullPage: true,
      });
      await more.focus();
      await page.keyboard.press("Enter");
      await expect(details).not.toHaveAttribute("open", "");
      // Verify actual keyboard navigation through a primary destination too.
      await nav
        .getByRole("link", { name: "People & agents", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL("/discover");
      await expect(
        nav.getByRole("link", { name: "People & agents", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
  }
}

// Next 16 may stream notFound after sending HTTP 200. Assert the real fallback
// and robots signal in addition to the only documented status outcomes.
export async function expectUnavailablePage(page: Page, path: string) {
  const response = await page.goto(path);
  expect([200, 404], path).toContain(response!.status());
  await expect(
    page.getByRole("heading", { name: "Nothing to see here.", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]').first(),
  ).toBeAttached();
}
