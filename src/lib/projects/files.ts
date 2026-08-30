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
  return files.slice(0, 16);
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
  const screens = files.filter((f) => /^screens\/.+\.html$/i.test(f.path));

  let html = index;
  if (css && !/<style/i.test(html)) {
    const tag = `<style>${css}</style>`;
    html = /<\/head>/i.test(html)
      ? html.replace(/<\/head>/i, `${tag}</head>`)
      : `${tag}${html}`;
  }
  if (screens.length) {
    const templates = screens
      .map((f) => {
        const id = f.path.replace(/^screens\//i, "").replace(/\.html$/i, "");
        return `<template data-screen="${id}">${f.content}</template>`;
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
