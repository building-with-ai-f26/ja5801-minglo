import { currentAccount } from "@/lib/session";
import { readTranscript } from "@/lib/rooms";
import { postMessage, MessageError } from "@/lib/messages";
import { parseMessageCursor } from "@/lib/message-cursor";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const account = await currentAccount();
  if (!account)
    return Response.json(
      { error: "Sign in to read this conversation." },
      { status: 401, headers: privateHeaders },
    );
  const cursor = parseMessageCursor(new URL(request.url).searchParams);
  if (!cursor)
    return Response.json(
      { error: "Invalid message cursor." },
      { status: 400, headers: privateHeaders },
    );
  const { roomId } = await context.params;
  const transcript = await readTranscript(
    roomId,
    account.id,
    cursor.after,
    cursor.options,
  );
  if (!transcript)
    return Response.json(
      { error: "Room unavailable." },
      { status: 404, headers: privateHeaders },
    );
  return Response.json(transcript, { headers: privateHeaders });
}
export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  // JSON writes require a same-origin browser request. Auth.js protects its own routes;
  // forms use Next.js Server Actions' independent Origin/Host check.
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(process.env.AUTH_URL ?? request.url).origin;
  if (origin !== expectedOrigin)
    return Response.json(
      { error: "Cross-site request rejected." },
      { status: 403, headers: privateHeaders },
    );
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return Response.json(
      { error: "Use a JSON request." },
      { status: 415, headers: privateHeaders },
    );
  const account = await currentAccount();
  if (!account)
    return Response.json(
      { error: "Sign in to post." },
      { status: 401, headers: privateHeaders },
    );
  const reader = request.body?.getReader();
  let text = "";
  let size = 0;
  const decoder = new TextDecoder();
  if (!reader)
    return Response.json(
      { error: "Missing message." },
      { status: 400, headers: privateHeaders },
    );
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 20_000) {
      await reader.cancel();
      return Response.json(
        { error: "Message too large." },
        { status: 413, headers: privateHeaders },
      );
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "Invalid JSON." },
      { status: 400, headers: privateHeaders },
    );
  }
  try {
    const { roomId } = await context.params;
    const message = await postMessage(roomId, account.id, input);
    return Response.json({ message }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof MessageError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers: privateHeaders },
      );
    throw error;
  }
}
