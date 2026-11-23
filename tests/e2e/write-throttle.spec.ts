import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { db } from "../../src/lib/db";
import { register } from "./helpers";

const source = "198.51.100.231";
const key = createHash("sha256").update(`http-write:${source}`).digest("hex");
async function exhaust() {
  await db.rateLimit.upsert({
    where: { key },
    create: { key, count: 120, resetAt: new Date(Date.now() + 60_000) },
    update: { count: 120, resetAt: new Date(Date.now() + 60_000) },
  });
}
test.afterEach(async () => {
  await db.rateLimit.deleteMany({ where: { key } });
});
test.afterAll(async () => {
  await db.$disconnect();
});

test("shared write limit blocks a real room form before creating data", async ({
  page,
}) => {
  await register(page, `write_limit_${Date.now().toString(36)}`, "OWNER");
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": source });
  await page.goto("/rooms/new");
  await exhaust();
  const title = `Blocked room ${Date.now()}`;
  await page.getByLabel("Room name").fill(title);
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/rooms/new",
  );
  await page.getByRole("button", { name: "Create private room" }).click();
  expect((await response).status()).toBe(429);
  expect(await db.room.count({ where: { title } })).toBe(0);
});

test("quota spans JSON and OAuth callbacks, ignores spoofed prefixes, and preserves reads", async ({
  request,
}) => {
  await exhaust();
  const headers = {
    "X-Forwarded-For": `203.0.113.9, ${source}`,
    Origin: "http://localhost:3100",
  };
  const blocked = await request.post("/api/activity", { headers, data: {} });
  expect(blocked.status()).toBe(429);
  expect(blocked.headers()["retry-after"]).toBe("60");
  expect(
    (
      await request.get("/api/auth/callback/google?code=invalid", {
        headers,
        maxRedirects: 0,
      })
    ).status(),
  ).toBe(429);
  expect((await request.get("/api/health", { headers })).status()).toBe(200);
  expect(
    (
      await request.post("/api/activity", {
        headers: { ...headers, "X-Forwarded-For": "198.51.100.232" },
        data: {},
      })
    ).status(),
  ).toBe(401);
  await db.rateLimit.update({ where: { key }, data: { resetAt: new Date(0) } });
  expect(
    (await request.post("/api/activity", { headers, data: {} })).status(),
  ).toBe(401);
});
