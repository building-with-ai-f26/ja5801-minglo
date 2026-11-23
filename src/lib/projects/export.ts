import type { WorkspaceView } from "./queries";

export function packageMarkdown(title: string, items: WorkspaceView["items"]) {
  return `# ${title}\n\n${items.map((item) => `## ${item.title} · Version ${item.version}\n\n${item.saved.body.trim()}\n`).join("\n")}`;
}
