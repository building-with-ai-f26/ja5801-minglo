"use server";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import {
  createDiscussion,
  postDiscussionMessage,
  readTopic,
  setTopicFollow,
} from "@/lib/topics";
import { topicsEnabled } from "@/lib/topic-launch";
import { discussionPath } from "@/lib/discussion-path";
import { MessageError } from "@/lib/messages";
import type { FormState } from "./account";
import type { MessageState } from "./messages";

export async function topicFollowAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!topicsEnabled()) return { error: "Topics is unavailable." };
  const account = await requireAccount("/topics");
  const topic = await readTopic(account.id, String(form.get("slug") ?? ""));
  if (!topic) return { error: "Topic unavailable." };
  const intent = form.get("intent");
  if (intent !== "follow" && intent !== "unfollow")
    return { error: "Choose follow or unfollow." };
  await setTopicFollow(account.id, topic.id, intent === "follow");
  revalidatePath("/topics", "layout");
  revalidatePath("/discover");
  return {
    success:
      intent === "follow"
        ? "Topic saved in your followed topics."
        : "Topic unfollowed.",
  };
}

export async function createDiscussionAction(
  slug: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!topicsEnabled()) return { error: "Topics is unavailable." };
  const account = await requireAccount(`/topics/${slug}/new`);
  const topic = await readTopic(account.id, slug);
  if (!topic) notFound();
  let id: string;
  try {
    const created = await createDiscussion(account.id, topic.id, {
      title: form.get("title"),
      body: form.get("body"),
      clientCreationId: form.get("clientCreationId"),
    });
    id = created.id;
  } catch (error) {
    if (error instanceof MessageError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/topics/${slug}`);
  revalidatePath("/inbox");
  redirect(discussionPath(slug, id));
}

export async function postDiscussionAction(
  slug: string,
  threadId: string,
  _state: MessageState,
  form: FormData,
): Promise<MessageState> {
  if (!topicsEnabled()) return { error: "Topics is unavailable." };
  const account = await requireAccount(discussionPath(slug, threadId));
  const topic = await readTopic(account.id, slug);
  if (!topic) return { error: "Topic unavailable." };
  try {
    const m = await postDiscussionMessage(account.id, topic.id, threadId, {
      body: form.get("body"),
      clientMessageId: form.get("clientMessageId"),
      replyToId: form.get("replyToId"),
    });
    revalidatePath(discussionPath(slug, threadId));
    revalidatePath(`/topics/${slug}`);
    revalidatePath("/inbox");
    return { sentId: m.id };
  } catch (error) {
    if (error instanceof MessageError) return { error: error.message };
    throw error;
  }
}
