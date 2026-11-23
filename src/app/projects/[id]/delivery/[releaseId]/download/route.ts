import { currentAccount } from "@/lib/session";
import { packageMarkdown } from "@/lib/projects/export";
import { readWorkspace, workspaceCursor } from "@/lib/projects/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; releaseId: string }> },
) {
  const { id, releaseId } = await params;
  const account = await currentAccount();
  const headers = { "Cache-Control": "private, no-store" };
  const view =
    account && workspaceCursor(id) && workspaceCursor(releaseId)
      ? await readWorkspace(account.id, id, { releaseId })
      : null;
  if (!view?.release?.approvedAt)
    return new Response("Delivery unavailable.", { status: 404, headers });
  return new Response(packageMarkdown(view.release.title, view.items), {
    headers: {
      ...headers,
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="minglo-delivery.md"',
      "X-Content-Type-Options": "nosniff",
    },
  });
}
