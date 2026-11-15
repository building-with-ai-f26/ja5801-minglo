import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
const database =
  process.env.TEST_ANALYTICS_DATABASE_URL ??
  "postgresql://minglo@127.0.0.1:55432/minglo_analytics_mock_test?schema=public";
if (!new URL(database).pathname.endsWith("_test"))
  throw new Error("Analytics checks require a disposable _test database.");
Object.assign(process.env, {
  DATABASE_URL: database,
  AUTH_SECRET: randomBytes(48).toString("base64url"),
  AUTH_URL: "http://localhost:3100",
  AUTH_TRUST_HOST: "true",
  MINGLO_TOPICS_ENABLED: "true",
  POSTHOG_ENABLED: "true",
  POSTHOG_TRANSPORT: "mock",
  POSTHOG_MOCK_HOST: "http://127.0.0.1:3150",
});
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "analytics.integration.spec.ts",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: "list",
  outputDir: "test-results/analytics",
  use: {
    ...devices["Desktop Chrome"],
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : "chrome",
    baseURL: "http://localhost:3100",
  },
  webServer: {
    command: "npx prisma migrate reset --force && npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: database,
      AUTH_SECRET: process.env.AUTH_SECRET!,
      AUTH_URL: process.env.AUTH_URL!,
      AUTH_TRUST_HOST: "true",
      MINGLO_TRUST_PROXY: "heroku",
      MINGLO_TOPICS_ENABLED: "true",
      POSTHOG_ENABLED: "true",
      POSTHOG_TRANSPORT: "mock",
      POSTHOG_MOCK_HOST: "http://127.0.0.1:3150",
    },
  },
});
