"use server";
import { requireAccount } from "@/lib/session";
import { allowAttempt } from "@/lib/rate-limit";
import {
  fetchGithubProfile,
  githubUsername,
  type GithubImportResult,
} from "@/lib/github-profile";

export async function importGithubProfileAction(
  input: unknown,
): Promise<GithubImportResult> {
  const account = await requireAccount("/profile?edit=1");
  const username = githubUsername.safeParse(input);
  if (!username.success)
    return { error: "Enter a public GitHub username, without a URL or @." };
  if (!(await allowAttempt("github-profile-import", account.id, 10)))
    return {
      error: "You've made several lookups. Please try again in 15 minutes.",
    };
  // This action previews public fields only. Existing profile saving remains separate.
  return fetchGithubProfile(username.data);
}
