function inline(value: string) {
  return value
    .split(/(\[[^\]\n]{1,100}\]\([^\s)]+\)|\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      if (link)
        return (
          <a
            key={index}
            href={link[2]}
            rel="noopener noreferrer"
            target="_blank"
          >
            {link[1]}
          </a>
        );
      return part;
    });
}

export function DocumentText({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const content = [];
  for (let index = 0; index < lines.length;) {
    const key = index;
    const line = lines[index++];
    if (!line.trim()) continue;
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      content.push(<h3 key={key}>{inline(heading[1])}</h3>);
      continue;
    }
    const bullet = /^\s*([-*]|\d+\.)\s+/;
    if (bullet.test(line)) {
      const Tag = /^\s*\d+\./.test(line) ? "ol" : "ul";
      const items = [line.replace(bullet, "")];
      while (index < lines.length && bullet.test(lines[index]))
        items.push(lines[index++].replace(bullet, ""));
      content.push(
        <Tag key={key}>
          {items.map((item, id) => (
            <li key={id}>{inline(item)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const cells = (raw: string) =>
      raw
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((part) => part.trim());
    if (
      line.includes("|") &&
      /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(
        lines[index] ?? "",
      )
    ) {
      index++;
      const headers = cells(line);
      const rows = [];
      while (index < lines.length && lines[index].includes("|"))
        rows.push(cells(lines[index++]));
      content.push(
        <div key={key} className="workspace-table">
          <table>
            <thead>
              <tr>
                {headers.map((cell, column) => (
                  <th key={column} scope="col">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, id) => (
                <tr key={id}>
                  {headers.map((_, column) => (
                    <td key={column}>{inline(row[column] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    content.push(<p key={key}>{inline(line)}</p>);
  }
  return <div className="workspace-document">{content}</div>;
}

export function Difference({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  let leading = 0;
  let trailing = 0;
  while (
    leading < Math.min(oldLines.length, newLines.length) &&
    oldLines[leading] === newLines[leading]
  )
    leading++;
  while (
    trailing < Math.min(oldLines.length, newLines.length) - leading &&
    oldLines[oldLines.length - 1 - trailing] ===
      newLines[newLines.length - 1 - trailing]
  )
    trailing++;
  return (
    <div className="workspace-split workspace-diff">
      {(
        [
          ["del", beforeLabel, oldLines],
          ["ins", afterLabel, newLines],
        ] as const
      ).map(([Mark, label, lines]) => (
        <div key={label}>
          <h3>{label}</h3>
          <pre>
            {lines.slice(0, leading).join("\n")}
            {leading > 0 && "\n"}
            <Mark>
              {lines.slice(leading, lines.length - trailing).join("\n")}
            </Mark>
            {trailing > 0 && `\n${lines.slice(-trailing).join("\n")}`}
          </pre>
        </div>
      ))}
    </div>
  );
}
