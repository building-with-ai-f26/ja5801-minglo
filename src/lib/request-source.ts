import { isIP } from "node:net";

// Only enable this for direct Heroku router traffic. Heroku appends its observed
// client address to the right of X-Forwarded-For; caller-supplied prefixes are ignored.
export function requestSource(
  headers: Headers,
  trustHeroku = process.env.MINGLO_TRUST_PROXY === "heroku" ||
    !!process.env.DYNO,
) {
  if (!trustHeroku) return "unknown";
  const address = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  if (!address || !isIP(address)) return "unknown";
  if (isIP(address) === 4) return address;
  try {
    return new URL(`http://[${address}]`).hostname;
  } catch {
    return "unknown";
  }
}
