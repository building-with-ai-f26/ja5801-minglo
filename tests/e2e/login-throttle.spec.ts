import { test, expect, type APIRequestContext } from "@playwright/test";
import { hash } from "argon2";
import { db } from "../../src/lib/db";
import { password } from "./helpers";
import { requestSource } from "../../src/lib/request-source";

async function attempt(
  context: APIRequestContext,
  handle: string,
  value: string,
) {
  const { csrfToken } = await (await context.get("/api/auth/csrf")).json();
  return context.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      handle,
      password: value,
      callbackUrl: "http://localhost:3100/dashboard",
    },
    headers: { "X-Auth-Return-Redirect": "1" },
  });
}

test.afterAll(async () => {
  await db.$disconnect();
});

test("forwarded client addresses require a trusted router and ignore spoofed prefixes", () => {
  const headers = new Headers({
    "X-Forwarded-For": "203.0.113.1, 198.51.100.10",
  });
  expect(requestSource(headers, false)).toBe("unknown");
  expect(requestSource(headers, true)).toBe("198.51.100.10");
  expect(
    requestSource(
      new Headers({ "X-Forwarded-For": "198.51.100.10, invalid" }),
      true,
    ),
  ).toBe("unknown");
  expect(
    requestSource(
      new Headers({ "X-Forwarded-For": "2001:0db8:0:0:0:0:0:1" }),
      true,
    ),
  ).toBe(
    requestSource(new Headers({ "X-Forwarded-For": "2001:db8::1" }), true),
  );
});

test("one source cannot exhaust another source's login allowance for the same handle", async ({
  playwright,
}) => {
  const handle = `throttle_${Date.now().toString(36)}`;
  await db.account.create({
    data: {
      handle,
      type: "OWNER",
      passwordHash: await hash(password),
      owner: { create: { displayName: "Throttle test" } },
    },
  });
  const attacker = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.1, 198.51.100.10" },
  });
  const victim = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.20" },
  });
  for (let i = 0; i < 20; i++)
    await attempt(attacker, handle, "TheWrongPassword!");
  await attempt(attacker, handle, password);
  expect(
    (await (await attacker.get("/api/auth/session")).json())?.user,
  ).toBeUndefined();
  const changedPrefix = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.44, 198.51.100.10" },
  });
  await attempt(changedPrefix, handle, password);
  expect(
    (await (await changedPrefix.get("/api/auth/session")).json())?.user,
  ).toBeUndefined();
  await attempt(victim, handle, password);
  expect(
    (await (await victim.get("/api/auth/session")).json())?.user?.name,
  ).toBe(handle);
  await attacker.dispose();
  await victim.dispose();
  await changedPrefix.dispose();
});
