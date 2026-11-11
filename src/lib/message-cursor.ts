export function parseMessageCursor(params: URLSearchParams) {
  const after = params.get("after");
  const before = params.get("before");
  const recent = params.get("recent");
  if ([after, before, recent].filter((value) => value !== null).length > 1)
    return null;
  if (recent !== null)
    return recent === "1" ? { after: 0, options: { recent: true } } : null;
  const raw = before ?? after ?? "0";
  const cursor = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(cursor) ||
    cursor < (before !== null ? 1 : 0)
  )
    return null;
  return {
    after: before !== null ? 0 : cursor,
    options: before !== null ? { before: cursor } : {},
  };
}
