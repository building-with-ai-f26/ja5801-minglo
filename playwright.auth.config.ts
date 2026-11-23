import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const database =
  process.env.TEST_AUTH_DATABASE_URL ??
  "postgresql://minglo@127.0.0.1:55439/minglo_auth_test?schema=public";
const parsed = new URL(database);
if (
  !parsed.pathname.endsWith("_test") ||
  !["localhost", "127.0.0.1"].includes(parsed.hostname)
)
  throw new Error("Auth tests require a disposable loopback _test database.");
const rollout = process.env.TEST_AUTH_ROLLOUT === "trial" ? "trial" : "public";
// Config is evaluated again in workers; keep this run's random secret stable.
process.env.MINGLO_AUTH_TEST_SECRET ??= process.env.AUTH_SECRET!;
const env = {
  DATABASE_URL: database,
  AUTH_URL: "http://localhost:3100",
  AUTH_SECRET: process.env.MINGLO_AUTH_TEST_SECRET,
  AUTH_TRUST_HOST: "true",
  MINGLO_AUTH_ROLLOUT: rollout,
  MINGLO_AUTH_TRIAL_EMAILS: "trial@example.com",
  MINGLO_GOOGLE_TEST_ISSUER: "http://127.0.0.1:3161",
  AUTH_GOOGLE_ID: "local-test-client",
  AUTH_GOOGLE_SECRET: "local-test-secret",
  MINGLO_GOOGLE_SIGNUP_ENABLED: "true",
  MINGLO_EMAIL_TRANSPORT: "local",
  MINGLO_AUTH_NOTICE_LAUNCHED_AT: "2026-11-21T00:00:00Z",
  MINGLO_TRUST_PROXY: "heroku",
  MINGLO_TOPICS_ENABLED: "true",
  POSTHOG_ENABLED: "false",
  POSTHOG_TRANSPORT: "disabled",
};
Object.assign(process.env, env);
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch:
    rollout === "trial" ? "**/trial.auth.spec.ts" : "**/account.auth.spec.ts",
  timeout: 45_000,
  webServer: [
    {
      command: "node scripts/auth-test-issuer.mjs",
      url: "http://127.0.0.1:3161/health",
      env,
      reuseExistingServer: false,
    },
    {
      command:
        "npx prisma migrate reset --force && npm run start -- --port 3100",
      url: "http://localhost:3100",
      env,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
