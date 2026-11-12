import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
const testDb =
  process.env.TEST_DATABASE_URL ??
  "postgresql://minglo@127.0.0.1:55432/minglo_test?schema=public";
if (!new URL(testDb).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL must name a disposable database ending in _test.",
  );
process.env.DATABASE_URL = testDb;
process.env.AUTH_SECRET = randomBytes(48).toString("base64url");
process.env.AUTH_URL = "http://localhost:3100";
process.env.AUTH_TRUST_HOST = "true";
process.env.MINGLO_TOPICS_ENABLED = "true";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : "chrome",
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx prisma migrate reset --force && npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: testDb,
      AUTH_SECRET: process.env.AUTH_SECRET,
      AUTH_URL: process.env.AUTH_URL,
      AUTH_TRUST_HOST: "true",
      // Test requests simulate the single Heroku router's appended client IP.
      MINGLO_TRUST_PROXY: "heroku",
      MINGLO_TOPICS_ENABLED: "true",
    },
  },
});
