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
  return files.slice(0, 24);
}

function screenIdFromAttrs(attrs: string) {
  return (
    attrs.match(/\bid=["']t-([^"']+)["']/)?.[1] ||
    attrs.match(/data-screen=["']([^"']+)["']/)?.[1] ||
    ""
  ).toLowerCase();
}

export function extractScreens(html: string): ProjectFile[] {
  if (!html) return [];
  const out: ProjectFile[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<template([^>]*)>([\s\S]*?)<\/template>/gi)) {
    const id = screenIdFromAttrs(match[1] ?? "");
    const content = (match[2] ?? "").trim();
    if (!id || !content || seen.has(id)) continue;
    seen.add(id);
    out.push({ path: `screens/${id}.html`, content });
  }
  return out;
}

export function ensureScreenFiles(files: ProjectFile[], html: string): ProjectFile[] {
  const map = new Map(files.map((f) => [f.path, f]));
  if (html && !map.has("index.html")) map.set("index.html", { path: "index.html", content: html });
  for (const screen of extractScreens(html)) {
    if (!map.has(screen.path)) map.set(screen.path, screen);
  }
  return [...map.values()];
}

export function assembleHtml(files: ProjectFile[], fallbackHtml = "") {
  let index =
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
  const screens = files.filter((f) => /^screens\/.+\.html$/i.test(f.path));

  let html = index;
  if (css && !/<style/i.test(html)) {
    const tag = `<style>${css}</style>`;
    html = /<\/head>/i.test(html)
      ? html.replace(/<\/head>/i, `${tag}</head>`)
      : `${tag}${html}`;
  }
  if (screens.length) {
    for (const f of screens) {
      const id = f.path.replace(/^screens\//i, "").replace(/\.html$/i, "");
      const tRe = new RegExp(
        `(<template[^>]*\\bid=["']t-${id}["'][^>]*>)[\\s\\S]*?(</template>)`,
        "i",
      );
      if (tRe.test(html)) {
        html = html.replace(tRe, `$1${f.content}$2`);
      }
    }
    const missing = screens.filter((f) => {
      const id = f.path.replace(/^screens\//i, "").replace(/\.html$/i, "");
      return !new RegExp(`id=["']t-${id}["']`, "i").test(html);
    });
    if (missing.length) {
    const templates = missing
      .map((f) => {
        const id = f.path.replace(/^screens\//i, "").replace(/\.html$/i, "");
        return `<template id="t-${id}" data-screen="${id}">${f.content}</template>`;
      })
      .join("");
    const router = `<script data-fenix-screens>
(function(){
  var main=document.querySelector("main.fk-main, main");
  if(!main) return;
  function show(id){
    var t=document.querySelector('template[data-screen="'+id+'"]');
    if(!t) return;
    main.innerHTML=t.innerHTML;
    document.querySelectorAll(".fk-tab button, nav[aria-label] button").forEach(function(b){
      b.classList.toggle("on", b.getAttribute("data-view")===id);
    });
  }
  document.addEventListener("click", function(e){
    var b=e.target && e.target.closest && e.target.closest(".fk-tab button, nav[aria-label] button");
    if(!b) return;
    var id=b.getAttribute("data-view");
    if(id) show(id);
  });
  var on=document.querySelector(".fk-tab button.on, nav[aria-label] button.on");
  var start=(on && on.getAttribute("data-view")) || (document.querySelector("template[data-screen]")||{}).getAttribute?.("data-screen");
  if(start) show(start);
})();
</script>`;
    html = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${templates}${router}</body>`)
      : `${html}${templates}${router}`;
    }
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
  return ensureScreenFiles([{ path: name, content: html }], html);
}
