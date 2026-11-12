import { z } from "zod";

export function parseConversationKey(key: string) {
  if (key === "public")
    return { kind: "public" as const, path: "/public-room" };
  const match = /^(private|direct|discussion):([^:]+)$/.exec(key);
  if (!match || !z.string().cuid().safeParse(match[2]).success) return null;
  const [, kind, id] = match;
  if (kind === "private") return { kind, id, path: `/rooms/${id}` } as const;
  if (kind === "direct") return { kind, id, path: `/messages/${id}` } as const;
  // Discussion routes are introduced by S6. Fail closed until then.
  return null;
}
