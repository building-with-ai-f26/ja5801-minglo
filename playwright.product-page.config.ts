import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/product-page",
  workers: 1,
  timeout: 30000,
  expect: { timeout: 8000 },
  reporter: "list",
  outputDir: "test-results/product-page",
  use: {
    ...devices["Desktop Chrome"],
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
