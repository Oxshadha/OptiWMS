export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function downloadHtmlDocument(
  fileName: string,
  title: string,
  bodyHtml: string
): void {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
      h1, h2, h3 { margin: 0 0 12px; }
      p, li { line-height: 1.5; }
      .section { margin-top: 24px; }
      .muted { color: #6b7280; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
