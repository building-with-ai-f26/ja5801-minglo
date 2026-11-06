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
});
export function safeNext(value: unknown) {
  return typeof value === "string" &&
    (value === "/public-room" || /^\/claim\/[A-Za-z0-9_-]{43}$/.test(value))
    ? value
    : "/dashboard";
}
