import { test, expect } from "@playwright/test";
import { prepare, home } from "./support";
test("no SDK or third-party request before a choice; refusal survives reload", async ({
  page,
  context,
}) => {
  const observed = await prepare(context);
  await page.goto(home);
  await expect(page.getByRole("status")).toContainText("off");
  expect(observed.requests).toEqual([]);
  await page
    .getByRole("button", { name: "Keep analytics off", exact: true })
    .click();
  await page.reload();
  await expect(page.getByRole("status")).toContainText("off");
  expect(observed.requests).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});
test("actual SDK sends a sanitized pageview and explicit product click without delaying navigation", async ({
  page,
  context,
}) => {
  const observed = await prepare(context);
  await page.goto(
    `${home}?SECRET_QUERY=PRIVATE&minglo_analytics_test=1#SECRET_FRAGMENT`,
    { referer: "https://example.org/SECRET_REFERRER" },
  );
  await page
    .getByRole("button", { name: "Allow page analytics", exact: true })
    .click();
  await expect.poll(() => observed.events.length).toBe(1);
  expect(observed.events[0].event).toBe("$pageview");
  expect(observed.events[0].properties).toMatchObject({
    environment: "verification",
    surface: "product_page",
    page_name: "product_page",
    schema_version: 1,
    $geoip_disable: true,
    $current_url: home,
    $pathname: "/ja5801-minglo/",
    $process_person_profile: false,
  });
  expect(observed.events[0].properties.distinct_id).toMatch(/^[0-9a-f-]{36}$/);
  await page.evaluate(() => {
    const secret = document.createElement("input");
    secret.type = "password";
    secret.value = "SECRET_INPUT";
    document.body.append(secret);
    (window as any).posthog.capture("$autocapture", {
      secret: "SECRET_AUTOCAPTURE",
    });
    (window as any).posthog.capture("$snapshot", {
      secret: "SECRET_RECORDING",
    });
  });
  await page.getByRole("link", { name: "Open Minglo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Product destination" }),
  ).toBeVisible();
  await expect.poll(() => observed.events.length).toBe(2);
  expect(observed.events[1].event).toBe("product_button_clicked");
  expect(observed.events[1].properties).toMatchObject({
    button: "open_minglo",
    placement: "hero",
  });
  expect(JSON.stringify(observed.events)).not.toMatch(
    /SECRET|PRIVATE|\$set|\$session_id|\$referrer/,
  );
  expect(
    observed.requests.filter((p) => /flags|decide|recorder|snapshot/.test(p)),
  ).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});
test("withdrawal stops an initialized SDK and persists across reload", async ({
  page,
  context,
}) => {
  const observed = await prepare(context);
  await page.goto(home);
  await page
    .getByRole("button", { name: "Allow page analytics", exact: true })
    .click();
  await expect.poll(() => observed.events.length).toBe(1);
  await page
    .getByRole("button", { name: "Turn page analytics off", exact: true })
    .click();
  await page.reload();
  await expect(page.getByRole("status")).toContainText("off");
  await page.getByRole("link", { name: "Open Minglo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Product destination" }),
  ).toBeVisible();
  expect(observed.events).toHaveLength(1);
  expect(observed.requests.filter((p) => p.endsWith("array.js"))).toHaveLength(
    1,
  );
});
test("withdrawal reaches another open tab without modifying app consent", async ({
  page,
  context,
}) => {
  const observed = await prepare(context);
  await page.goto(home);
  await page
    .getByRole("button", { name: "Allow page analytics", exact: true })
    .click();
  await expect.poll(() => observed.events.length).toBe(1);
  const other = await context.newPage();
  await other.goto(home);
  await expect.poll(() => observed.events.length).toBe(2);
  await page
    .getByRole("button", { name: "Turn page analytics off", exact: true })
    .click();
  await expect(other.getByRole("status")).toContainText("off");
  await other.getByRole("link", { name: "Open Minglo", exact: true }).click();
  await expect(
    other.getByRole("heading", { name: "Product destination" }),
  ).toBeVisible();
  expect(observed.events).toHaveLength(2);
});
test("withdrawing during SDK loading cannot release queued events", async ({
  page,
  context,
}) => {
  let release!: () => void;
  const delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  const observed = await prepare(context, { delay });
  await page.goto(home);
  await page
    .getByRole("button", { name: "Allow page analytics", exact: true })
    .click();
  await expect.poll(() => observed.requests.length).toBe(1);
  await page
    .getByRole("button", { name: "Turn page analytics off", exact: true })
    .click();
  release();
  await expect
    .poll(() => page.evaluate(() => !!(window as any).posthog?.__loaded))
    .toBe(true);
  expect(observed.events).toHaveLength(0);
});
test("blocked SDK never prevents the product link", async ({
  page,
  context,
}) => {
  const observed = await prepare(context, { blocked: true });
  await page.goto(home);
  await page
    .getByRole("button", { name: "Allow page analytics", exact: true })
    .click();
  await page.getByRole("link", { name: "Open Minglo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Product destination" }),
  ).toBeVisible();
  expect(observed.events).toHaveLength(0);
});
test("JavaScript-disabled visitors can open the product with analytics off", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const observed = await prepare(context);
    const page = await context.newPage();
    await page.goto(home);
    await expect(page.getByRole("status")).toContainText(
      "Page analytics is off",
    );
    await expect(
      page.getByRole("button", { name: "Allow page analytics", exact: true }),
    ).toBeDisabled();
    await page.getByRole("link", { name: "Open Minglo", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Product destination" }),
    ).toBeVisible();
    expect(observed.requests).toEqual([]);
  } finally {
    await context.close();
  }
});
test("controls, notes and image evidence fit desktop and narrow screens", async ({
  page,
  context,
}) => {
  await prepare(context);
  await page.goto(home);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator(".build-notes").evaluate((node: HTMLDetailsElement) => {
      node.open = true;
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const id of ["analytics-allow", "analytics-decline"]) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: `test-results/product-page/page-${width}.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `test-results/product-page/consent-${width}.png`,
    });
  }
  await page
    .getByRole("button", { name: "Allow page analytics", exact: true })
    .focus();
  await expect(
    page.getByRole("button", { name: "Allow page analytics", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("allowed");
});

test("unavailable storage requires fresh consent on the next visit", async ({
  page,
  context,
}) => {
  const observed = await prepare(context);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.goto(home);
  expect(observed.requests).toEqual([]);
  await page
    .getByRole("button", { name: "Allow page analytics", exact: true })
    .click();
  await expect.poll(() => observed.events.length).toBe(1);
  await expect(page.getByRole("status")).toContainText("could not remember");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("off");
  expect(observed.events).toHaveLength(1);
});
