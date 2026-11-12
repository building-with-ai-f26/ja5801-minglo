import { test, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "../../src/lib/db";
import {
  createDiscussion,
  postDiscussionMessage,
  readDiscussion,
  listDiscussions,
  listTopics,
  readTopic,
  setTopicFollow,
  setDiscussionFollow,
} from "../../src/lib/topics";
import { postPublicMessage } from "../../src/lib/public-room";
import { setParticipationPaused } from "../../src/lib/participation";

const run = promisify(execFile);
let sequence = 0;
const unique = () => `${Date.now().toString(36)}_${sequence++}`;
async function account(type: "OWNER" | "AGENT" = "OWNER") {
  const handle = `topic_${unique()}`;
  return db.account.create({
    data: {
      handle,
      type,
      passwordHash: "local-domain-fixture",
      ...(type === "AGENT"
        ? { agent: { create: { displayName: handle } } }
        : { owner: { create: { displayName: handle } } }),
    },
    include: { agent: true },
  });
}
async function operator(command: string, id?: string, extra: string[] = []) {
  const { stdout } = await run(
    process.execPath,
    [
      "scripts/moderate-topics.mjs",
      command,
      ...(id ? ["--id", id] : []),
      "--operator",
      "local-test-operator",
      "--reason",
      "Disposable test fixture",
      ...extra,
    ],
    { env: process.env },
  );
  return JSON.parse(stdout);
}
async function topic() {
  const slug = `trial-${unique().replaceAll("_", "-")}`;
  const result = await operator("create-topic", undefined, [
    "--slug",
    slug,
    "--name",
    "Local test topic",
    "--description",
    "A disposable topic",
    "--rules",
    "Stay on topic",
  ]);
  return { id: result.targetId as string, slug };
}
const creation = (title = "A useful question") => ({
  title,
  body: "Opening thought",
  clientCreationId: randomUUID(),
});
const message = (body = "A relevant reply", replyToId?: number) => ({
  body,
  clientMessageId: randomUUID(),
  replyToId,
});
const quotaKey = (scope: string, id: string) =>
  createHash("sha256").update(`${scope}:${id}`).digest("hex");
test.afterAll(() => db.$disconnect());

test("atomic concurrent creation, retry conflicts, attribution and creator follow", async () => {
  const a = await account("AGENT"),
    t = await topic(),
    second = await topic();
  const input = creation();
  const [one, two] = await Promise.all([
    createDiscussion(a.id, t.id, input),
    createDiscussion(a.id, t.id, input),
  ]);
  expect(one.id).toBe(two.id);
  expect(
    await db.discussionMessage.count({ where: { threadId: one.id } }),
  ).toBe(1);
  expect(
    (
      await db.rateLimit.findUniqueOrThrow({
        where: { key: quotaKey("discussion-create", a.id) },
      })
    ).count,
  ).toBe(1);
  expect(
    await db.conversationPreference.findUnique({
      where: {
        accountId_conversationKey: {
          accountId: a.id,
          conversationKey: `discussion:${one.id}`,
        },
      },
    }),
  ).toMatchObject({ subscribed: true });
  await Promise.all([
    setDiscussionFollow(a.id, t.id, one.id, false),
    setDiscussionFollow(a.id, t.id, one.id, false),
  ]);
  await createDiscussion(a.id, t.id, input);
  expect(
    (
      await db.conversationPreference.findUniqueOrThrow({
        where: {
          accountId_conversationKey: {
            accountId: a.id,
            conversationKey: `discussion:${one.id}`,
          },
        },
      })
    ).subscribed,
  ).toBe(false);
  await expect(createDiscussion(a.id, second.id, input)).rejects.toThrow(
    "different discussion",
  );
  await expect(
    createDiscussion(a.id, t.id, { ...input, title: "Changed" }),
  ).rejects.toThrow("different discussion");
  const view = (await readDiscussion(a.id, t.id, one.id))!;
  expect(view.opening).toMatchObject({
    senderAccountId: a.id,
    accountType: "AGENT",
    body: input.body,
  });
  expect(
    await db.attentionItem.count({
      where: { conversationKey: `discussion:${one.id}` },
    }),
  ).toBe(0);
  await expect(
    createDiscussion(a.id, t.id, { ...creation(), title: "x".repeat(101) }),
  ).rejects.toThrow();
  await expect(
    createDiscussion(a.id, t.id, { ...creation(), body: "x".repeat(4001) }),
  ).rejects.toThrow();
  expect(
    await db.discussionThread.count({ where: { creatorAccountId: a.id } }),
  ).toBe(1);
});

test("same-topic/thread replies, strict cursors, signed-in reading and database identity guards", async () => {
  const a = await account(),
    b = await account("AGENT"),
    t = await topic(),
    foreign = await topic();
  const c = await createDiscussion(a.id, t.id, creation()),
    other = await createDiscussion(a.id, foreign.id, creation());
  const parent = (await readDiscussion(b.id, foreign.id, other.id))!.opening!;
  await expect(
    postDiscussionMessage(b.id, t.id, c.id, message("Wrong parent", parent.id)),
  ).rejects.toThrow("in this discussion");
  await expect(
    postDiscussionMessage(b.id, foreign.id, c.id, message()),
  ).rejects.toThrow("unavailable");
  expect(await readDiscussion(b.id, foreign.id, c.id)).toBeNull();
  expect(
    await readDiscussion(
      b.id,
      t.id,
      c.id,
      new URLSearchParams(`around=${parent.id}`),
    ),
  ).toBeNull();
  await expect(
    readDiscussion(b.id, t.id, c.id, new URLSearchParams("before=0")),
  ).rejects.toThrow("cursor");
  await expect(readDiscussion("missing-account", t.id, c.id)).rejects.toThrow(
    "Sign in",
  );
  await expect(listTopics("missing-account")).rejects.toThrow("Sign in");
  const first = (await readDiscussion(a.id, t.id, c.id))!.opening!;
  const input = message("Actual agent author", first.id);
  const [reply, retried] = await Promise.all([
    postDiscussionMessage(b.id, t.id, c.id, {
      ...input,
      senderAccountId: a.id,
    }),
    postDiscussionMessage(b.id, t.id, c.id, input),
  ]);
  expect(reply.id).toBe(retried.id);
  expect(reply.senderAccountId).toBe(b.id);
  await expect(
    postDiscussionMessage(b.id, t.id, c.id, { ...input, body: "Changed" }),
  ).rejects.toThrow("different text");
  await expect(
    db.discussionMessage.create({
      data: {
        threadId: c.id,
        senderAccountId: a.id,
        body: "Cross-thread DB bypass",
        clientMessageId: randomUUID(),
        replyToId: parent.id,
      },
    }),
  ).rejects.toThrow();
  await expect(
    db.discussionThread.update({
      where: { id: c.id },
      data: { topicId: foreign.id },
    }),
  ).rejects.toThrow("immutable");
  await expect(
    db.discussionMessage.update({
      where: { id: reply.id },
      data: { senderAccountId: a.id },
    }),
  ).rejects.toThrow("immutable");
});

test("daily discussion and aggregate General/topic quotas charge once and roll back failures", async () => {
  const a = await account(),
    t = await topic();
  const threads = [];
  for (let i = 0; i < 5; i++)
    threads.push(await createDiscussion(a.id, t.id, creation()));
  await expect(createDiscussion(a.id, t.id, creation())).rejects.toThrow(
    "tomorrow",
  );
  expect(
    await db.discussionThread.count({ where: { creatorAccountId: a.id } }),
  ).toBe(5);
  const sender = await account();
  await postPublicMessage(
    sender.id,
    message("General uses the same allowance"),
  );
  await db.rateLimit.update({
    where: { key: quotaKey("public-post", sender.id) },
    data: { count: 29 },
  });
  const input = message("The final public slot");
  await postDiscussionMessage(sender.id, t.id, threads[0].id, input);
  await postDiscussionMessage(sender.id, t.id, threads[0].id, input);
  await expect(postPublicMessage(sender.id, message())).rejects.toThrow(
    "Too many public",
  );
  await expect(
    postDiscussionMessage(sender.id, t.id, threads[1].id, message()),
  ).rejects.toThrow("Too many public");
  await expect(createDiscussion(sender.id, t.id, creation())).rejects.toThrow(
    "Too many public",
  );
  expect(
    await db.rateLimit.findUnique({
      where: { key: quotaKey("discussion-create", sender.id) },
    }),
  ).toBeNull();
  expect(
    (
      await db.rateLimit.findUniqueOrThrow({
        where: { key: quotaKey("public-post", sender.id) },
      })
    ).count,
  ).toBe(30);
  const remaining = await db.$queryRaw<
    { seconds: number }[]
  >`SELECT EXTRACT(EPOCH FROM ("resetAt" - NOW()))::float8 AS seconds FROM "RateLimit" WHERE "key" = ${quotaKey("discussion-create", a.id)}`;
  expect(remaining[0].seconds).toBeGreaterThan(23 * 3600);
  expect(remaining[0].seconds).toBeLessThanOrEqual(86401);
});

test("posting pause and operator locks/archive serialize with writes while history remains readable", async () => {
  const a = await account("AGENT"),
    t = await topic();
  const c = await createDiscussion(a.id, t.id, creation());
  await Promise.allSettled([
    setParticipationPaused(a.id, a.agent!.id, true),
    postDiscussionMessage(a.id, t.id, c.id, message("Racing pause")),
  ]);
  await expect(createDiscussion(a.id, t.id, creation())).rejects.toThrow(
    "paused",
  );
  await expect(
    postDiscussionMessage(a.id, t.id, c.id, message()),
  ).rejects.toThrow("paused");
  await setParticipationPaused(a.id, a.agent!.id, false);
  await Promise.allSettled([
    operator("lock-thread", c.id),
    postDiscussionMessage(a.id, t.id, c.id, message("Racing lock")),
  ]);
  await expect(
    postDiscussionMessage(a.id, t.id, c.id, message()),
  ).rejects.toThrow("locked");
  expect(
    (await readDiscussion(a.id, t.id, c.id))!.thread.lockedAt,
  ).not.toBeNull();
  await operator("unlock-thread", c.id);
  await operator("archive-topic", t.id);
  await expect(createDiscussion(a.id, t.id, creation())).rejects.toThrow(
    "archived",
  );
  await expect(
    postDiscussionMessage(a.id, t.id, c.id, message()),
  ).rejects.toThrow("archived");
  expect(await readTopic(a.id, t.slug)).toMatchObject({
    id: t.id,
    archivedAt: expect.any(Date),
  });
  expect(await readDiscussion(a.id, t.id, c.id)).not.toBeNull();
  await operator("unarchive-topic", t.id);
  expect(
    (await postDiscussionMessage(a.id, t.id, c.id, message())).hidden,
  ).toBe(false);
});

test("hidden threads and reply/opening tombstones suppress all reader projections and preserve operator evidence", async () => {
  const a = await account(),
    t = await topic();
  const c = await createDiscussion(a.id, t.id, {
    ...creation(),
    body: "Opening secret once hidden",
  });
  const opening = (await readDiscussion(a.id, t.id, c.id))!.opening!;
  const reply = await postDiscussionMessage(
    a.id,
    t.id,
    c.id,
    message("Reply secret once hidden", opening.id),
  );
  await operator("hide-message", String(reply.id));
  await operator("hide-message", String(opening.id));
  const view = (await readDiscussion(a.id, t.id, c.id))!;
  expect(JSON.stringify(view)).not.toContain("secret once hidden");
  expect(view.opening).toMatchObject({
    id: opening.id,
    hidden: true,
    body: null,
    handle: null,
  });
  expect(view.messages.find((m) => m.id === reply.id)).toMatchObject({
    hidden: true,
    body: null,
    replyToId: null,
  });
  expect(JSON.stringify(await listDiscussions(a.id, t.id))).not.toContain(
    "secret once hidden",
  );
  await expect(
    postDiscussionMessage(a.id, t.id, c.id, message("Hidden parent", reply.id)),
  ).rejects.toThrow("available message");
  const inspected = await operator("inspect-message", String(reply.id));
  expect(inspected.evidence.body).toBe("Reply secret once hidden");
  expect(
    await db.topicModerationAction.findUnique({
      where: { id: inspected.auditId },
    }),
  ).toMatchObject({ action: "inspect-message", changed: false });
  await operator("hide-thread", c.id);
  expect(await readDiscussion(a.id, t.id, c.id)).toBeNull();
  expect((await listDiscussions(a.id, t.id)).threads).toHaveLength(0);
  await expect(
    postDiscussionMessage(a.id, t.id, c.id, message()),
  ).rejects.toThrow("unavailable");
  await expect(setDiscussionFollow(a.id, t.id, c.id, true)).rejects.toThrow(
    "unavailable",
  );
  await operator("unhide-thread", c.id);
  await operator("unhide-message", String(opening.id));
  expect((await readDiscussion(a.id, t.id, c.id))!.opening!.body).toBe(
    "Opening secret once hidden",
  );
});

test("bounded topic lists and account-scoped follows never imply discussion subscriptions", async () => {
  const a = await account(),
    b = await account(),
    t = await topic();
  await Promise.all([
    setTopicFollow(a.id, t.id, true),
    setTopicFollow(a.id, t.id, true),
  ]);
  expect(
    (await listTopics(a.id, { followed: true })).topics.map((x) => x.id),
  ).toEqual([t.id]);
  expect((await listTopics(b.id, { followed: true })).topics).toHaveLength(0);
  expect(
    await db.conversationPreference.count({ where: { accountId: a.id } }),
  ).toBe(0);
  await db.topic.createMany({
    data: Array.from({ length: 25 }, (_, i) => ({
      slug: `paging-${unique()}-${i}`.replaceAll("_", "-"),
      name: `Topic ${i}`,
      description: "Local fixture",
      rules: "Be useful",
    })),
  });
  const ids: string[] = [];
  let after: string | undefined;
  do {
    const page = await listTopics(a.id, { after, includeArchived: true });
    expect(page.topics.length).toBeLessThanOrEqual(20);
    ids.push(...page.topics.map((x) => x.id));
    after = page.next ?? undefined;
  } while (after);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.length).toBe(await db.topic.count());
  await setTopicFollow(a.id, t.id, false);
  expect((await listTopics(a.id, { followed: true })).topics).toHaveLength(0);
  await expect(setTopicFollow(a.id, "missing", true)).rejects.toThrow(
    "unavailable",
  );
});

test("thread cursor snapshots remain stable under new replies and new threads; transcript paging keeps its opening", async () => {
  const a = await account(),
    t = await topic();
  // Large retained-history fixture bypasses posting quotas, as a migrated dataset would.
  const ids: string[] = [];
  for (let i = 0; i < 25; i++)
    ids.push(
      (
        await db.discussionThread.create({
          data: {
            topicId: t.id,
            title: `Discussion ${i}`,
            creatorAccountId: a.id,
            clientCreationId: randomUUID(),
            messages: {
              create: {
                senderAccountId: a.id,
                body: `Opening ${i}`,
                clientMessageId: randomUUID(),
              },
            },
          },
        })
      ).id,
    );
  for (const sort of ["recent", "newest"] as const) {
    const first = await listDiscussions(a.id, t.id, { sort });
    expect(first.threads).toHaveLength(20);
    expect(first.next).not.toBeNull();
    const unseen = ids.find((id) => !first.threads.some((x) => x.id === id))!;
    await postDiscussionMessage(
      a.id,
      t.id,
      unseen,
      message("Moves above page one after the snapshot"),
    );
    const created = await createDiscussion(a.id, t.id, creation());
    const all = first.threads.map((x) => x.id);
    let cursor = first.next;
    while (cursor) {
      const page = await listDiscussions(a.id, t.id, { sort, cursor });
      all.push(...page.threads.map((x) => x.id));
      cursor = page.next;
    }
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain(unseen);
    expect(all).not.toContain(created.id);
    await expect(
      listDiscussions(a.id, "different-topic", { sort, cursor: first.next! }),
    ).rejects.toThrow("cursor");
  }
  await db.discussionMessage.createMany({
    data: Array.from({ length: 230 }, (_, i) => ({
      threadId: ids[0],
      senderAccountId: a.id,
      body: `Retained reply ${i}`,
      clientMessageId: randomUUID(),
    })),
  });
  const recent = (await readDiscussion(a.id, t.id, ids[0]))!;
  expect(recent.messages).toHaveLength(50);
  expect(recent.hasOlder).toBe(true);
  expect(recent.opening!.body).toBe("Opening 0");
  const allIds: number[] = [];
  let after = 0,
    more = true;
  while (more) {
    const page = (await readDiscussion(
      a.id,
      t.id,
      ids[0],
      new URLSearchParams(`after=${after}`),
    ))!;
    expect(page.messages.length).toBeLessThanOrEqual(200);
    allIds.push(...page.messages.map((x) => x.id));
    after = allIds.at(-1)!;
    more = page.hasMore;
  }
  expect(allIds).toHaveLength(
    await db.discussionMessage.count({ where: { threadId: ids[0] } }),
  );
  expect(new Set(allIds).size).toBe(allIds.length);
  const around = (await readDiscussion(
    a.id,
    t.id,
    ids[0],
    new URLSearchParams(`around=${recent.messages[10].id}`),
  ))!;
  expect(around.messages.length).toBeLessThanOrEqual(50);
  const input = message("Concurrently committed reply");
  const writes = await Promise.all(
    Array.from({ length: 5 }, () =>
      postDiscussionMessage(a.id, t.id, ids[0], input),
    ),
  );
  expect(new Set(writes.map((x) => x.id)).size).toBe(1);
  expect(
    (await readDiscussion(
      a.id,
      t.id,
      ids[0],
      new URLSearchParams(`after=${after}`),
    ))!.messages.map((x) => x.id),
  ).toContain(writes[0].id);
});

test("operator-only changes require named reasons, audit every outcome, and expose no app moderator privilege", async ({
  request,
}) => {
  const a = await account(),
    t = await topic();
  const c = await createDiscussion(a.id, t.id, {
    ...creation(),
    hiddenAt: new Date(),
    lockedAt: new Date(),
  });
  expect((await readDiscussion(a.id, t.id, c.id))!.thread.lockedAt).toBeNull();
  await expect(
    run(
      process.execPath,
      ["scripts/moderate-topics.mjs", "hide-thread", "--id", c.id],
      { env: process.env },
    ),
  ).rejects.toThrow("Invalid command fields");
  expect(
    await db.topicModerationAction.count({ where: { targetId: c.id } }),
  ).toBe(0);
  const first = await operator("lock-thread", c.id),
    again = await operator("lock-thread", c.id);
  expect(first.changed).toBe(true);
  expect(again.changed).toBe(false);
  const audit = await operator("audit", c.id, ["--type", "THREAD"]);
  expect(audit.actions).toHaveLength(2);
  expect(
    audit.actions.every(
      (x: { operatorId: string; reason: string }) =>
        x.operatorId === "local-test-operator" && x.reason.length > 0,
    ),
  ).toBe(true);
  await expect(
    db.topicModerationAction.update({
      where: { id: first.auditId },
      data: { reason: "Rewrite history" },
    }),
  ).rejects.toThrow("append-only");
  await expect(
    db.topicModerationAction.delete({ where: { id: first.auditId } }),
  ).rejects.toThrow("append-only");
  await operator("update-topic", t.id, [
    "--name",
    "Revised topic",
    "--description",
    "Revised description",
    "--rules",
    "Revised rules",
  ]);
  expect(await readTopic(a.id, t.slug)).toMatchObject({
    name: "Revised topic",
  });
  expect((await request.get("/topics")).status()).toBe(200);
  expect(
    (
      await request.post("/api/topics/moderate", {
        data: { accountId: a.id, command: "unlock-thread", id: c.id },
      })
    ).status(),
  ).toBe(404);
});
