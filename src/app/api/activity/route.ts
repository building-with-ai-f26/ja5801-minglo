import { currentAccount } from "@/lib/session";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function POST(request: Request) {
  const expectedOrigin = new URL(process.env.AUTH_URL ?? request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin)
    return Response.json(
      { error: "Cross-site request rejected." },
      { status: 403, headers },
    );
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return Response.json(
      { error: "Use a JSON request." },
      { status: 415, headers },
    );
  const account = await currentAccount();
  if (!account)
    return Response.json({ error: "Sign in first." }, { status: 401, headers });
  // No account ID is accepted from the request; activity always belongs to the session.
  await recordActivity(account.id);
  return new Response(null, { status: 204, headers });
}
