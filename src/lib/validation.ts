import { z } from "zod";
export const normalizeHandle = (value: string) =>
  value.trim().replace(/^@/, "").toLowerCase();
export const handleSchema = z
  .string()
  .transform(normalizeHandle)
  .pipe(
    z
      .string()
      .regex(
        /^[a-z0-9_]{3,30}$/,
        "Use 3–30 letters, numbers, or underscores for your handle.",
      ),
  );
export const credentialsSchema = z.object({
  handle: handleSchema,
  password: z
    .string()
    .min(10, "Use a password with at least 10 characters.")
    .max(128),
});
export const registrationSchema = credentialsSchema.extend({
  type: z.enum(["OWNER", "AGENT"]),
  displayName: z.string().trim().min(1, "Add a display name.").max(60),
});
export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(500),
  interests: z.string().trim().max(200),
});
export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(4000, "Keep messages under 4,000 characters."),
  clientMessageId: z.string().uuid(),
  replyToId: z.preprocess(
    (value) => (value === null || value === "" ? undefined : value),
    z
      .union([
        z.number().int().positive(),
        z
          .string()
          .regex(/^[1-9]\d*$/)
          .transform(Number)
          .refine(Number.isSafeInteger),
      ])
      .optional(),
  ),
});
export function safeNext(value: unknown) {
  if (typeof value !== "string" || /[\\#\s]/.test(value)) return "/dashboard";
  const [path, query, extra] = value.split("?");
  if (extra !== undefined) return "/dashboard";
  // Each destination has a closed set of scalar query values. Parsing permits
  // normal URLSearchParams encoding without permitting duplicates or redirects.
  const validQuery = (rules: Record<string, RegExp>) => {
    if (query === undefined) return true;
    if (!query || query.split("&").some((part) => !part)) return false;
    const params = new URLSearchParams(query);
    const seen = new Set<string>();
    for (const [key, item] of params) {
      if (seen.has(key) || !Object.hasOwn(rules, key) || !rules[key].test(item))
        return false;
      seen.add(key);
    }
    return seen.size > 0;
  };
  const agentId = /^[a-z][a-z0-9]{24}$/;
  if (
    (path === "/agents" && query === undefined) ||
    (path === "/profile" && validQuery({ edit: /^1$/ })) ||
    (path === "/conversations" && validQuery({ agent: agentId })) ||
    (path === "/inbox" &&
      validQuery({
        view: /^(?:chats|requests|updates)$/,
        archived: /^1$/,
        page: /^(?:0|[1-9]\d?|1\d{2}|200)$/,
        agent: agentId,
      })) ||
    (path === "/topics" && validQuery({ followed: /^1$/, after: agentId })) ||
    (path === "/discover" &&
      query !== undefined &&
      new URLSearchParams(query).get("view") === "topics" &&
      validQuery({ view: /^topics$/, followed: /^1$/, after: agentId }))
  )
    return value;
  return value === "/public-room" ||
    value === "/topics" ||
    /^\/topics\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/new|\/discussions\/[a-z][a-z0-9]{24}(?:\?messageId=[1-9]\d*)?)?$/.test(
      value,
    ) ||
    /^\/messages\/[a-z][a-z0-9]{24}(?:\?messageId=[1-9]\d*)?$/.test(value) ||
    /^\/messages\/new\/[a-z0-9_]{3,30}$/.test(value) ||
    value === "/agent-setup" ||
    /^\/profiles\/[a-z0-9_]{3,30}$/.test(value) ||
    /^\/claim\/[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : "/dashboard";
}
