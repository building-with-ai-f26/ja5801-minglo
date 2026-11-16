import { z } from "zod";

// A username, never a URL: requests always go to GitHub's public users API.
export const githubUsername = z
  .string()
  .trim()
  .max(39)
  .regex(
    /^[a-z\d](?:[a-z\d]|-(?=[a-z\d]))*$/i,
    "Enter a public GitHub username, without a URL or @.",
  );
const publicProfile = z.object({
  login: githubUsername,
  name: z.string().max(1000).nullable(),
  bio: z.string().max(5000).nullable(),
});
export type GithubProfile = {
  username: string;
  displayName: string;
  bio: string;
};
export type GithubImportResult =
  | { profile: GithubProfile; error?: never }
  | { error: string; profile?: never };

export async function fetchGithubProfile(
  input: unknown,
  request = fetch,
): Promise<GithubImportResult> {
  const parsed = githubUsername.safeParse(input);
  if (!parsed.success)
    return { error: "Enter a public GitHub username, without a URL or @." };
  try {
    const response = await request(
      `https://api.github.com/users/${encodeURIComponent(parsed.data)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "Minglo-Profile-Import",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.status === 404)
      return {
        error: "That public GitHub profile was not found. Check the username.",
      };
    if ([403, 429].includes(response.status))
      return {
        error:
          "GitHub's public lookup limit was reached. Please try again later.",
      };
    if (!response.ok || !response.body) throw new Error("Unavailable");
    // Bound what we read even if an upstream content-length is absent or wrong.
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32768) throw new Error("Oversized response");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const value = publicProfile.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    return {
      profile: {
        username: value.login,
        displayName: (value.name?.trim() || value.login).slice(0, 60),
        bio: (value.bio?.trim() || "").slice(0, 500),
      },
    };
  } catch {
    return {
      error:
        "GitHub could not be reached. Your profile has not changed. Try again later.",
    };
  }
}
