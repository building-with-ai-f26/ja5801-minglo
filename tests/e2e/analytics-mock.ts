import { createServer } from "node:http";
import { gunzipSync } from "node:zlib";
export type MockEvent = {
  event: string;
  distinct_id?: string;
  properties?: Record<string, unknown>;
  uuid?: string;
  timestamp?: string;
};
export const mockEvents: MockEvent[] = [];
export const mockRequests: string[] = [];
export let failDelivery = false;
export const setMockFailure = (value: boolean) => {
  failDelivery = value;
};
export const collector = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "http://localhost:3100");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  mockRequests.push(request.url ?? "");
  if (failDelivery) {
    response.writeHead(503);
    response.end();
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks);
    const body =
      raw[0] === 0x1f && raw[1] === 0x8b
        ? gunzipSync(raw).toString()
        : raw.toString();
    let parsed;
    if (body.startsWith("{") || body.startsWith("[")) parsed = JSON.parse(body);
    else {
      const form = new URLSearchParams(body);
      const data = form.get("data") ?? "";
      const buffer = Buffer.from(data, "base64");
      parsed = JSON.parse(
        data.startsWith("{") || data.startsWith("[")
          ? data
          : (form.get("compression") ??
                new URL(
                  request.url ?? "/",
                  "http://127.0.0.1",
                ).searchParams.get("compression")) === "gzip-js"
            ? gunzipSync(buffer).toString()
            : buffer.toString(),
      );
    }
    const events = Array.isArray(parsed) ? parsed : (parsed.batch ?? [parsed]);
    mockEvents.push(...events);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"status":1}');
  } catch {
    response.writeHead(400);
    response.end();
  }
});
