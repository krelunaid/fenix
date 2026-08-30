export type ProjectFile = {
  path: string;
  content: string;
};

const FILE_RE =
  /<<<FILE path="([^"]+)">>>\s*([\s\S]*?)(?=(?:<<<FILE path=)|(?:<<<END>>>)|$)/g;

export function parseProjectFiles(text: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(FILE_RE)) {
    const path = (match[1] ?? "").replace(/^\/+/, "").trim();
    const content = (match[2] ?? "").trim();
    if (!path || !content || seen.has(path)) continue;
    seen.add(path);
    files.push({ path, content });
  }
  return files.slice(0, 12);
}

export function assembleHtml(files: ProjectFile[], fallbackHtml = "") {
  const index =
    files.find((f) => /(^|\/)index\.html$/i.test(f.path))?.content ?? fallbackHtml;
  if (!index) return "";

  const css = files
    .filter((f) => f.path.endsWith(".css"))
    .map((f) => f.content)
    .join("\n");
  const js = files
    .filter((f) => f.path.endsWith(".js"))
    .map((f) => f.content)
    .join("\n;\n");

  let html = index;
  if (css && !/<style/i.test(html)) {
    const tag = `<style>${css}</style>`;
    html = /<\/head>/i.test(html)
      ? html.replace(/<\/head>/i, `${tag}</head>`)
      : `${tag}${html}`;
  }
  if (js && !new RegExp(js.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(html)) {
    const tag = `<script>${js}</script>`;
    html = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${tag}</body>`)
      : `${html}${tag}`;
  }
  return html;
}

export function filesFromHtml(html: string, name = "index.html"): ProjectFile[] {
  if (!html) return [];
  return [{ path: name, content: html }];
}
