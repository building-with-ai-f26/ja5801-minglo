// Run after npm run build: TEST_DATABASE_URL=..._test node --import tsx scripts/check-topic-restart.mjs
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";

const databaseUrl = process.env.TEST_DATABASE_URL;
assert(
  databaseUrl && new URL(databaseUrl).pathname.endsWith("_test"),
  "Set TEST_DATABASE_URL to a disposable _test database.",
);
const port = Number(process.env.TOPIC_RESTART_PORT ?? 3105);
assert(
  Number.isInteger(port) && port >= 1024 && port <= 65535,
  "Invalid test port.",
);
process.env.DATABASE_URL = databaseUrl;
const { db } = await import("../src/lib/db.ts");
const {
  createDiscussion,
  postDiscussionMessage,
  readDiscussion,
  listDiscussions,
  setTopicFollow,
} = await import("../src/lib/topics.ts");
const env = {
  ...process.env,
  NODE_ENV: "production",
  MINGLO_TOPICS_ENABLED: "false",
  AUTH_SECRET: randomBytes(48).toString("base64url"),
  AUTH_URL: `http://localhost:${port}`,
  AUTH_TRUST_HOST: "true",
};
let server;
async function start() {
  // Refuse to borrow or stop another agent's server.
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { env, stdio: "ignore" },
  );
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("Production server exited before readiness.");
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Production server did not become ready.");
}
async function stop() {
  if (server && server.exitCode === null) {
    const stopped = once(server, "exit");
    server.kill("SIGTERM");
    await stopped;
  }
  server = undefined;
}
try {
  const suffix = randomBytes(6).toString("hex");
  const account = await db.account.create({
    data: {
      handle: `restart_topic_${suffix}`,
      type: "OWNER",
      passwordHash: "disposable-domain-fixture",
      owner: { create: { displayName: "Restart fixture" } },
    },
  });
  const topic = await db.topic.create({
    data: {
      slug: `restart-${suffix}`,
      name: "Restart fixture",
      description: "Disposable",
      rules: "Disposable",
    },
  });
  const thread = await createDiscussion(account.id, topic.id, {
    title: "Persistent topic history",
    body: "Opening retained across restarts",
    clientCreationId: randomUUID(),
  });
  const reply = await postDiscussionMessage(account.id, topic.id, thread.id, {
    body: "Hidden retained reply",
    clientMessageId: randomUUID(),
  });
  await setTopicFollow(account.id, topic.id, true);
  const moderate = (command, id) =>
    execFileSync(
      process.execPath,
      [
        "scripts/moderate-topics.mjs",
        command,
        "--id",
        id,
        "--operator",
        "local-restart-check",
        "--reason",
        "Disposable persistence verification",
      ],
      { env, stdio: "pipe" },
    );
  moderate("hide-message", String(reply.id));
  moderate("lock-thread", thread.id);
  async function snapshot() {
    const transcript = await readDiscussion(account.id, topic.id, thread.id);
    assert.equal(transcript.opening.body, "Opening retained across restarts");
    assert.equal(transcript.messages.find((m) => m.id === reply.id).body, null);
    assert(transcript.thread.lockedAt);
    return JSON.stringify({
      transcript,
      lists: await listDiscussions(account.id, topic.id),
      follows: await db.topicFollow.findMany({
        where: { accountId: account.id },
      }),
      preferences: await db.conversationPreference.findMany({
        where: { accountId: account.id },
      }),
      audit: await db.topicModerationAction.findMany({
        where: {
          OR: [
            { targetId: thread.id },
            { targetType: "MESSAGE", targetId: String(reply.id) },
          ],
        },
        orderBy: { id: "asc" },
      }),
      retained: await db.discussionMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { id: "asc" },
      }),
    });
  }
  await start();
  const before = await snapshot();
  await stop();
  await start();
  assert.equal(await snapshot(), before);
  const disabled = await fetch(`http://127.0.0.1:${port}/topics`);
  // Request-time notFound can stream with HTTP 200 in this Next.js version.
  const disabledHtml = await disabled.text();
  assert([200, 404].includes(disabled.status));
  assert(disabledHtml.includes("Nothing to see here."));
  assert(disabledHtml.includes("noindex"));
  assert(!disabledHtml.includes("Find a discussion worth joining."));
  assert.equal(
    (
      await fetch(
        `http://127.0.0.1:${port}/api/topics/${topic.slug}/discussions/${thread.id}/messages`,
      )
    ).status,
    404,
  );
  console.log(
    "Topic production restart passed: opening/reply IDs, hidden evidence, lock, follows, preferences and audit preserved; Topics remains gated.",
  );
} finally {
  await stop();
  await db.$disconnect();
}
