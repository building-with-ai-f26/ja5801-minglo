export function discussionPath(slug: string, id: string) {
  return `/topics/${encodeURIComponent(slug)}/discussions/${encodeURIComponent(id)}`;
}
