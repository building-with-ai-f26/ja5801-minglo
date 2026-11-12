import { currentAccount } from "@/lib/session";
import { topicsEnabled } from "@/lib/topic-launch";
import { readTopic, readDiscussion } from "@/lib/topics";
import { MessageError } from "@/lib/messages";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  if (!topicsEnabled())
    return Response.json({ error: "Unavailable." }, { status: 404, headers });
  const account = await currentAccount();
  if (!account)
    return Response.json(
      { error: "Sign in to read discussions." },
      { status: 401, headers },
    );
  const { slug, id } = await context.params;
  const topic = await readTopic(account.id, slug);
  if (!topic)
    return Response.json(
      { error: "Discussion unavailable." },
      { status: 404, headers },
    );
  const query = new URL(request.url).searchParams;
  const visible = query.get("visible");
  const contextIds = query.get("context");
  query.delete("visible");
  query.delete("context");
  if (
    visible &&
    (visible.length > 2400 ||
      visible.split(",").length > 200 ||
      !/^[1-9]\d*(?:,[1-9]\d*)*$/.test(visible))
  )
    return Response.json(
      { error: "Invalid visible message identifiers." },
      { status: 400, headers },
    );
  if (
    contextIds &&
    (contextIds.length > 24 ||
      contextIds.split(",").length > 2 ||
      !/^[1-9]\d*(?:,[1-9]\d*)*$/.test(contextIds))
  )
    return Response.json(
      { error: "Invalid reply/report context." },
      { status: 400, headers },
    );
  try {
    const result = await readDiscussion(account.id, topic.id, id, query, [
      ...(visible ? visible.split(",").map(Number) : []),
      ...(contextIds ? contextIds.split(",").map(Number) : []),
    ]);
    if (!result)
      return Response.json(
        { error: "Discussion unavailable." },
        { status: 404, headers },
      );
    const postingPaused = !!(await currentAccount())?.agent
      ?.participationPausedAt;
    return Response.json({ ...result, postingPaused }, { headers });
  } catch (e) {
    if (e instanceof MessageError)
      return Response.json({ error: e.message }, { status: e.status, headers });
    throw e;
  }
}
