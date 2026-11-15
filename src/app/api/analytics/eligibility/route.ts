import { currentAccount } from "@/lib/session";
import { browserAnalyticsState } from "@/lib/analytics/preferences";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  const account = await currentAccount();
  if (!account) return Response.json(null, { status: 401, headers });
  return Response.json(await browserAnalyticsState(account.id), { headers });
}
