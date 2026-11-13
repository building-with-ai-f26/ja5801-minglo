import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";

// Standalone config: importing the enabled config would overwrite the runner
// flag. Schedule sequentially after the enabled server stops: this checkout's
// .next directory is shared, regardless of database and port. The separate
// default database preserves full enabled-suite fixtures for restart checks.
const testDb =
  process.env.TEST_TOPICS_OFF_DATABASE_URL ??
  "postgresql://minglo@127.0.0.1:55432/minglo_topics_off_test?schema=public";
if (!new URL(testDb).pathname.endsWith("_test"))
  throw new Error(
    "Topics-off tests require a disposable database ending in _test.",
  );
process.env.DATABASE_URL = testDb;
process.env.AUTH_SECRET = randomBytes(48).toString("base64url");
process.env.AUTH_URL = "http://localhost:3106";
process.env.AUTH_TRUST_HOST = "true";
process.env.MINGLO_TOPICS_ENABLED = "false";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.topics-off.spec.ts",
  outputDir: "test-results/topics-off",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : "chrome",
    baseURL: "http://localhost:3106",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx prisma migrate reset --force && npm run dev -- --port 3106",
    url: "http://localhost:3106",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: testDb,
      AUTH_SECRET: process.env.AUTH_SECRET,
      AUTH_URL: process.env.AUTH_URL,
      AUTH_TRUST_HOST: "true",
      MINGLO_TRUST_PROXY: "heroku",
      MINGLO_TOPICS_ENABLED: "false",
    },
  },
});
