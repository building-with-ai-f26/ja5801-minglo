export function parseMessageCursor(params: URLSearchParams) {
  const after = params.get("after");
  const before = params.get("before");
  const recent = params.get("recent");
  const around = params.get("around");
  if (
    [after, before, recent, around].filter((value) => value !== null).length > 1
  )
    return null;
  if (recent !== null)
    return recent === "1" ? { after: 0, options: { recent: true } } : null;
  const raw = around ?? before ?? after ?? "0";
  const cursor = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(cursor) ||
    cursor < (before !== null || around !== null ? 1 : 0)
  )
    return null;
  if (around !== null) return { after: 0, options: { around: cursor } };
  return {
    after: before !== null ? 0 : cursor,
    options: before !== null ? { before: cursor } : {},
  };
}
