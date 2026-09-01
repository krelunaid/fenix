import { looksLikeLeakedCss } from "./color-scheme.ts";

export type ProjectFile = {
  path: string;
  content: string;
};

export const ENTRYPOINT = "index.html";
export const MAX_PROJECT_FILES = 48;
export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_TREE_BYTES = 1_500_000;
export const MAX_PATH_LENGTH = 180;

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}


export type FileReject = { path: string; reason: string };

export type IngestResult = {
  files: ProjectFile[];
  rejected: FileReject[];
  entrypoint: string;
};

const FILE_RE =
  /<<<FILE path="([^"]+)">>>\s*([\s\S]*?)(?=(?:<<<FILE path=)|(?:<<<END>>>)|$)/g;

const ALLOWED_EXT = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".svg",
  ".csv",
  ".xml",
  ".map",
  ".ts",
  ".tsx",
  ".jsx",
]);

const SECRETISH =
  /-----BEGIN[\s\S]+?PRIVATE KEY|-----BEGIN [\s\S]+?-----|"private_key"\s*:|Bearer\s+[A-Za-z0-9._\-+/=]{16,}|\bsk-[A-Za-z0-9]{8,}|\bxai-[A-Za-z0-9]{8,}|\bnf_[A-Za-z0-9]{12,}/i;

export function canonicalizePath(raw: string): { ok: true; path: string } | { ok: false; reason: string } {
  let p = String(raw ?? "").replace(/\\/g, "/").trim();
  if (!p) return { ok: false, reason: "vuoto" };
  if (p.includes("\0") || /[\x00-\x1f\x7f]/.test(p)) return { ok: false, reason: "caratteri di controllo" };
  if (/^[a-zA-Z]:/.test(p) || p.startsWith("/") || p.startsWith("//")) {
    return { ok: false, reason: "percorso assoluto" };
  }
  if (p.startsWith("~")) return { ok: false, reason: "percorso assoluto" };
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") return { ok: false, reason: "traversal" };
    parts.push(seg);
  }
  const clean = parts.join("/");
  if (!clean) return { ok: false, reason: "vuoto" };
  if (clean.length > MAX_PATH_LENGTH) return { ok: false, reason: "percorso troppo lungo" };
  if (!/^[A-Za-z0-9._+\-]+(?:\/[A-Za-z0-9._+\-]+)*$/.test(clean)) {
    return { ok: false, reason: "caratteri non ammessi" };
  }
  if (/^(?:\.git|node_modules)(?:\/|$)/i.test(clean) || /(^|\/)\.env(?:$|\.)/i.test(clean)) {
    return { ok: false, reason: "percorso riservato" };
  }
  if (clean.toLowerCase() === "fenix.json") return { ok: false, reason: "percorso riservato" };
  return { ok: true, path: clean };
}

function extOf(path: string): string {
  const base = path.split("/").pop() || "";
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i).toLowerCase() : "";
}

function looksBinary(content: string): boolean {
  if (content.includes("\0")) return true;
  const n = Math.min(content.length, 8_000);
  if (!n) return false;
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const c = content.charCodeAt(i);
    if (c === 0 || c < 9 || (c > 13 && c < 32) || c === 0xfffd) bad += 1;
  }
  return bad / n > 0.08;
}

export function fileLooksLikeSecret(content: string, path = ""): boolean {
  if (/\.(pem|p12|pfx|key)$/i.test(path)) return true;
  return SECRETISH.test(content);
}

export function inspectFile(path: string, content: string): { ok: true } | { ok: false; reason: string } {
  if (typeof content !== "string" || !content) return { ok: false, reason: "vuoto" };
  const ext = extOf(path);
  if (!ext || !ALLOWED_EXT.has(ext)) return { ok: false, reason: "estensione non ammessa" };
  if (utf8Bytes(content) > MAX_FILE_BYTES) return { ok: false, reason: "file troppo grande" };
  if (looksBinary(content)) return { ok: false, reason: "binario" };
  if (fileLooksLikeSecret(content, path)) return { ok: false, reason: "segreto" };
  return { ok: true };
}

export function entrypointOf(files: ProjectFile[]): string {
  if (files.some((f) => f.path === ENTRYPOINT)) return ENTRYPOINT;
  const html = files.find((f) => /\.html?$/i.test(f.path));
  return html?.path || ENTRYPOINT;
}

function sortTree(files: ProjectFile[]): ProjectFile[] {
  return [...files].sort((a, b) => {
    if (a.path === ENTRYPOINT) return -1;
    if (b.path === ENTRYPOINT) return 1;
    return a.path.localeCompare(b.path);
  });
}

/** Ingest generated files. POSIX relative, no traversal, no secrets, hard limits. */
export function ingestProjectFiles(
  input: ProjectFile[] | undefined,
  opts?: { html?: string },
): IngestResult {
  const rejected: FileReject[] = [];
  const byKey = new Map<string, ProjectFile>();
  let bytes = 0;

  const accept = (path: string, content: string, replace = false) => {
    const canon = canonicalizePath(path);
    if (!canon.ok) {
      rejected.push({ path, reason: canon.reason });
      return;
    }
    const check = inspectFile(canon.path, content);
    if (!check.ok) {
      rejected.push({ path: canon.path, reason: check.reason });
      return;
    }
    const key = canon.path.toLowerCase();
    const existing = byKey.get(key);
    if (existing && !replace) {
      rejected.push({ path: canon.path, reason: "collisione" });
      return;
    }
    if (!existing && byKey.size >= MAX_PROJECT_FILES) {
      rejected.push({ path: canon.path, reason: "limite file" });
      return;
    }
    const nextBytes = bytes - (existing ? utf8Bytes(existing.content) : 0) + utf8Bytes(content);
    if (nextBytes > MAX_TREE_BYTES) {
      rejected.push({ path: canon.path, reason: "albero troppo grande" });
      return;
    }
    bytes = nextBytes;
    byKey.set(key, { path: canon.path, content });
  };

  for (const file of input || []) accept(file.path, file.content, false);
  const html = typeof opts?.html === "string" ? opts.html : "";
  if (html) accept(ENTRYPOINT, html, true);

  const files = sortTree([...byKey.values()]);
  return { files, rejected, entrypoint: entrypointOf(files) };
}

export function parseProjectFiles(text: string): ProjectFile[] {
  const raw: ProjectFile[] = [];
  for (const match of text.matchAll(FILE_RE)) {
    const path = (match[1] ?? "").trim();
    const content = (match[2] ?? "").trim();
    if (!path || !content) continue;
    raw.push({ path, content });
  }
  return ingestProjectFiles(raw).files;
}

/** Desk kinds keep src/css/js. Phone `screens/` templates stay out of the portable tree. */
export function dropPhoneScreenFiles(files: ProjectFile[]): ProjectFile[] {
  return files.filter((f) => f.path === "index.html" || !/^screens\//i.test(f.path));
}

export function normalizeFilePath(path: string): string {
  const canon = canonicalizePath(path);
  return canon.ok ? canon.path : "";
}

/** Canonical project tree. HTML is denormalized live copy; files[] is the source. */
export function projectFiles(input: { html?: string; files?: ProjectFile[] }): ProjectFile[] {
  return ingestProjectFiles(input.files, { html: input.html }).files;
}

/** HTML-only projects become a one-file tree. Kind, storage and html stay. */
export function migrateProjectTree<T extends { html?: string; files?: ProjectFile[] }>(project: T): T {
  const files = projectFiles({ html: project.html, files: project.files });
  if (files.length === 0 && !(project.files && project.files.length)) return project;
  const same =
    (project.files?.length || 0) === files.length &&
    files.every((f, i) => project.files?.[i]?.path === f.path && project.files?.[i]?.content === f.content);
  if (same) return project;
  return { ...project, files };
}

export type FileTreeNode =
  | { kind: "dir"; name: string; path: string; children: FileTreeNode[] }
  | { kind: "file"; name: string; path: string };

export function fileTree(files: ProjectFile[]): FileTreeNode[] {
  type DirAcc = { kind: "dir"; name: string; path: string; children: FileTreeNode[]; dirs: Map<string, DirAcc> };
  const root: DirAcc = { kind: "dir", name: "", path: "", children: [], dirs: new Map() };
  for (const file of sortTree(files)) {
    const segs = file.path.split("/");
    let dir = root;
    for (let i = 0; i < segs.length - 1; i++) {
      const name = segs[i]!;
      const path = segs.slice(0, i + 1).join("/");
      let next = dir.dirs.get(name.toLowerCase());
      if (!next) {
        next = { kind: "dir", name, path, children: [], dirs: new Map() };
        dir.dirs.set(name.toLowerCase(), next);
        dir.children.push(next);
      }
      dir = next;
    }
    dir.children.push({ kind: "file", name: segs[segs.length - 1]!, path: file.path });
  }
  function freeze(node: DirAcc): FileTreeNode {
    const children = node.children
      .map((child) => (child.kind === "dir" ? freeze(child as DirAcc) : child))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return { kind: "dir", name: node.name, path: node.path, children };
  }
  const frozen = freeze(root);
  return frozen.kind === "dir" ? frozen.children : [];
}

function screenIdFromAttrs(attrs: string) {
  return (
    attrs.match(/\bid=["']t-([^"']+)["']/)?.[1] ||
    attrs.match(/data-screen=["']([^"']+)["']/)?.[1] ||
    ""
  ).toLowerCase();
}

const SCREEN_IDS = ["home", "new", "list", "stats", "more"] as const;

function stubScreen(id: string, name: string) {
  if (id === "home") {
    return `<section class="fk-sheet"><p class="fk-kicker">Oggi</p><dl class="fk-ledger"><div><dt>Voci</dt><dd>—</dd></div><div><dt>In corso</dt><dd>—</dd></div></dl><button type="button" class="fk-btn" data-go="new">Nuova riga</button></section>`;
  }
  if (id === "new") {
    return `<h2>Nuovo</h2><form><label class="fk-lbl">Nome</label><div class="fk-field"><input name="n" required placeholder="Nome"/></div><button type="submit" class="fk-btn">Salva</button></form>`;
  }
  if (id === "list") {
    return `<h2>Elenco</h2><p class="fk-role">Vuoto. Salva da Nuovo.</p>`;
  }
  if (id === "stats") {
    return `<h2>Numeri</h2><div class="fk-grid2"><div class="fk-tile"><span>Oggi</span><b>0</b></div><div class="fk-tile"><span>Mese</span><b>0</b></div></div>`;
  }
  return `<h2>Altro</h2><p class="fk-role">Impostazioni e staff.</p><form data-team><div class="fk-field"><input name="who" placeholder="Nome"/></div><button type="submit" class="fk-btn">Aggiungi</button></form>`;
}

export function seedFiveScreens(files: ProjectFile[], html: string, name = "App"): ProjectFile[] {
  const map = new Map(files.map((f) => [f.path, f]));
  if (html && !map.has("index.html")) map.set("index.html", { path: "index.html", content: html });
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]?.trim();
  if (
    main &&
    !looksLikeLeakedCss(main) &&
    (!map.get("screens/home.html")?.content || map.get("screens/home.html")!.content.length < 40)
  ) {
    map.set("screens/home.html", { path: "screens/home.html", content: main });
  }
  for (const id of SCREEN_IDS) {
    const path = `screens/${id}.html`;
    const cur = map.get(path)?.content?.trim() ?? "";
    if (cur.length < 24) map.set(path, { path, content: stubScreen(id, name) });
  }
  return [...map.values()];
}

export function extractScreens(html: string): ProjectFile[] {
  if (!html) return [];
  const out: ProjectFile[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<template([^>]*)>([\s\S]*?)<\/template>/gi)) {
    const id = screenIdFromAttrs(match[1] ?? "");
    const content = (match[2] ?? "").trim();
    if (!id || !content || seen.has(id)) continue;
    if (looksLikeLeakedCss(content)) continue;
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
  const tree = ingestProjectFiles(files, { html: fallbackHtml || undefined }).files;
  let index = tree.find((f) => f.path === ENTRYPOINT)?.content ?? fallbackHtml;
  if (!index) return "";

  const css = tree
    .filter((f) => f.path.endsWith(".css"))
    .map((f) => f.content)
    .join("\n");
  const js = tree
    .filter((f) => f.path.endsWith(".js") || f.path.endsWith(".mjs"))
    .map((f) => f.content)
    .join("\n;\n");
  const screens = tree.filter((f) => /^screens\/.+\.html$/i.test(f.path));

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
        if (looksLikeLeakedCss(f.content)) continue;
        html = html.replace(tRe, `$1${f.content}$2`);
      }
    }
    const missing = screens.filter((f) => {
      const id = f.path.replace(/^screens\//i, "").replace(/\.html$/i, "");
      return !new RegExp(`id=["']t-${id}["']`, "i").test(html);
    });
    if (missing.length) {
    const templates = missing
      .filter((f) => !looksLikeLeakedCss(f.content))
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
  const path = name === "index.html" ? ENTRYPOINT : name;
  return ingestProjectFiles([{ path, content: html }], { html }).files;
}

/** Preview/publish use only the validated entrypoint, never extra paths. */
export function previewHtmlFromTree(files: ProjectFile[], fallbackHtml = ""): string {
  const tree = ingestProjectFiles(files, { html: fallbackHtml || undefined }).files;
  return tree.find((f) => f.path === entrypointOf(tree))?.content || fallbackHtml || "";
}

/** Live preview is the denormalized HTML. Extra tree files are never executed as URLs. */
export function authorizedPreviewHtml(input: { html?: string; files?: ProjectFile[] }): string {
  const html = typeof input.html === "string" ? input.html : "";
  if (html) return html;
  return previewHtmlFromTree(input.files || []);
}
