import { expect, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
const origin = "https://building-with-ai-f26.github.io";
export const home = `${origin}/ja5801-minglo/`;
const sdk = readFileSync("node_modules/posthog-js/dist/array.js");
type Event = { event: string; properties: Record<string, unknown> };
export function decode(raw: Buffer, url: string): Event[] {
  let body =
    raw[0] === 0x1f && raw[1] === 0x8b
      ? gunzipSync(raw).toString()
      : raw.toString();
  if (!body.startsWith("{") && !body.startsWith("[")) {
    const form = new URLSearchParams(body);
    const data = form.get("data") ?? "";
    const compression =
      form.get("compression") ?? new URL(url).searchParams.get("compression");
    body =
      data.startsWith("{") || data.startsWith("[")
        ? data
        : compression === "gzip-js"
          ? gunzipSync(Buffer.from(data, "base64")).toString()
          : Buffer.from(data, "base64").toString();
  }
  const data = JSON.parse(body);
  return Array.isArray(data) ? data : (data.batch ?? [data]);
}
export async function prepare(
  context: BrowserContext,
  options: { blocked?: boolean; delay?: Promise<void>; replay?: boolean } = {},
) {
  const requests: string[] = [],
    events: Event[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "us-assets.i.posthog.com") {
      requests.push(url.pathname);
      if (options.blocked) return route.abort();
      if (options.delay) await options.delay;
      if (options.replay && url.pathname.endsWith("/config.js")) {
        const token = url.pathname.split("/")[2];
        return route.fulfill({
          contentType: "text/javascript",
          body: `window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG[${JSON.stringify(token)}]={config:{hasFeatureFlags:false,sessionRecording:{sampleRate:1,minimumDurationMilliseconds:0,endpoint:'/s/'}}};`,
        });
      }
      if (
        options.replay &&
        /\/(?:lazy-recorder|recorder)\.js$/.test(url.pathname)
      )
        return route.fulfill({
          contentType: "text/javascript",
          body: readFileSync(
            "node_modules/posthog-js/dist/" + url.pathname.split("/").at(-1),
          ),
        });
      expect(url.pathname).toBe("/static/1.450.0/array.js");
      return route.fulfill({ contentType: "text/javascript", body: sdk });
    }
    if (url.hostname === "us.i.posthog.com") {
      requests.push(url.pathname);
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type",
      };
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      const body = route.request().postDataBuffer();
      if (body && !url.pathname.includes("/flags"))
        events.push(...decode(body, url.href));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers,
        body: '{"status":1}',
      });
    }
    if (url.origin === origin && url.pathname.startsWith("/ja5801-minglo/")) {
      const relative =
        url.pathname.slice("/ja5801-minglo/".length) || "index.html";
      const file = path.resolve("docs", relative);
      if (!file.startsWith(path.resolve("docs") + path.sep))
        return route.abort();
      return route.fulfill({ path: file });
    }
    if (url.origin === "https://www.minglo.club") {
      return route.fulfill({
        contentType: "text/html",
        body: "<h1>Product destination</h1>",
      });
    }
    throw new Error(`Unexpected network host: ${url.hostname}`);
  });
  return { requests, events };
}
