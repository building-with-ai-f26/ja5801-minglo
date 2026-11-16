import { test, expect } from "@playwright/test";
import { prepare, home } from "./support";
import { safeReplayPage } from "../../docs/bounded-replay.js";

test("replay URL allowlist excludes private routes, credentials, queries and fragments", () => {
  expect(safeReplayPage(home)).toMatchObject({ surface: "product_page" });
  expect(
    safeReplayPage("http://localhost:3000/demo/github-profile"),
  ).toMatchObject({ surface: "local_demo" });
  for (const url of [
    "https://www.minglo.club/profile",
    "http://localhost:3000/messages/private",
    "http://localhost:3000/demo/github-profile?secret=1",
    `${home}?secret=1`,
    `${home}#secret`,
    "http://localhost:3000.evil.example/demo/github-profile",
    "http://user:password@localhost:3000/demo/github-profile",
  ])
    expect(safeReplayPage(url), url).toBeNull();
});

test("separate replay consent uses the real recorder, masks content and stops on withdrawal", async ({
  page,
  context,
}) => {
  const observed = await prepare(context, { replay: true });
  await page.goto(home);
  await page.locator(".replay-choice summary").click();
  await expect(
    page.getByRole("button", { name: "Allow this page recording" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Allow page analytics", exact: true })
    .click();
  await expect
    .poll(
      () =>
        observed.events.filter((event) => event.event === "$pageview").length,
    )
    .toBe(1);
  expect(
    observed.requests.some((path) => /recorder|config.js/.test(path)),
  ).toBe(false);
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.value = "PRIVATE_INPUT_7295";
    document.body.append(input);
    const text = document.createElement("p");
    text.textContent = "PRIVATE_BIO_7295";
    text.setAttribute("title", "PRIVATE_ATTRIBUTE_7295");
    document.body.append(text);
    const script = document.createElement("script");
    script.textContent = 'window.testPrivate="PRIVATE_SCRIPT_7295"';
    document.body.append(script);
  });
  await page.getByRole("button", { name: "Allow this page recording" }).click();
  await expect(page.locator("#replay-status")).toContainText(
    "Recording this demo page",
  );
  await page.mouse.move(300, 400);
  await page.mouse.click(300, 400);
  await expect
    .poll(
      () =>
        observed.events.filter((event) => event.event === "$snapshot").length,
      { timeout: 20000 },
    )
    .toBeGreaterThan(0);
  const snapshots = observed.events.filter(
    (event) => event.event === "$snapshot",
  );
  expect(JSON.stringify(snapshots)).not.toMatch(
    /PRIVATE_(INPUT|BIO|ATTRIBUTE|SCRIPT)_7295|\$set_once|\$initial_referrer/,
  );
  expect(snapshots[0].properties).toMatchObject({
    environment: "verification",
    $geoip_disable: true,
    surface: "product_page",
  });
  await page.getByRole("button", { name: "Turn page analytics off" }).click();
  await expect(page.locator("#replay-status")).toContainText(
    "Recording is off",
  );
  const count = observed.events.length;
  await page.mouse.click(350, 450);
  await page.waitForTimeout(3000);
  expect(observed.events).toHaveLength(count);
});

test("unsafe page URLs never load the recorder even after both consent buttons", async ({
  page,
  context,
}) => {
  const observed = await prepare(context, { replay: true });
  await page.goto(`${home}?private=SECRET`);
  await page
    .getByRole("button", { name: "Allow page analytics", exact: true })
    .click();
  await page.locator(".replay-choice summary").click();
  await expect(
    page.getByRole("button", { name: "Allow this page recording" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Allow this page recording" }).click();
  await expect(page.locator("#replay-status")).toContainText("could not start");
  expect(
    observed.requests.some((path) => /recorder|config.js/.test(path)),
  ).toBe(false);
});
