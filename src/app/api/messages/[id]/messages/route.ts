import { currentAccount } from "@/lib/session";
import {
  DirectMessageError,
  readDirectTranscript,
} from "@/lib/direct-messages";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const account = await currentAccount();
  if (!account)
    return Response.json(
      { error: "Sign in to read this chat." },
      { status: 401, headers },
    );
  try {
    const result = await readDirectTranscript(
      (await params).id,
      account.id,
      new URL(request.url).searchParams,
    );
    return result
      ? Response.json(result, { headers })
      : Response.json(
          { error: "Conversation unavailable." },
          { status: 404, headers },
        );
  } catch (error) {
    if (error instanceof DirectMessageError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers },
      );
    throw error;
  }
}
