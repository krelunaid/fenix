import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { APP_COMPONENTS, DASHBOARD_MOCK, SITE_MULTIFILE } from "./fixtures/trees.ts";
import {
  ENTRYPOINT,
  MAX_FILE_BYTES,
  MAX_PROJECT_FILES,
  MAX_TREE_BYTES,
  authorizedPreviewHtml,
  bundleProjectHtml,
  canonicalizePath,
  fileTree,
  ingestProjectFiles,
  migrateProjectTree,
  parseProjectFiles,
  dropPhoneScreenFiles,
  projectFiles,
  utf8Bytes,
} from "./files.ts";
import {
  MAX_PROJECT_ARCHIVE_BYTES,
  importProjectArchive,
  unzipProject,
  zipFiles,
  zipProject,
  treeManifest,
} from "./zip.ts";
import { recoverPersistedProject, type Recoverable } from "./recover.ts";
import { commitIfChanged, restoreProjectRevision } from "./revisions.ts";
import { DEFAULT_PALETTE, type Project } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ARGILLA = readFileSync(join(here, "fixtures/argilla-viva.html"), "utf8");

describe("ingest POSIX tree", () => {
  it("accepts the three distinct fixtures with explicit entrypoint", () => {
    for (const [label, files] of [
      ["site", SITE_MULTIFILE],
      ["dashboard", DASHBOARD_MOCK],
      ["app", APP_COMPONENTS],
    ] as const) {
      const got = ingestProjectFiles(files);
      assert.equal(
        got.rejected.length,
        0,
        `${label} ${got.rejected.map((r) => r.reason).join(",")}`,
      );
      assert.equal(got.entrypoint, ENTRYPOINT);
      assert.equal(got.files[0]?.path, ENTRYPOINT);
      assert.ok(got.files.length >= 3, label);
    }
    assert.ok(SITE_MULTIFILE.some((f) => f.path === "css/theme.css"));
    assert.ok(DASHBOARD_MOCK.some((f) => f.path === "data/ordini.json"));
    assert.ok(APP_COMPONENTS.some((f) => f.path === "src/components/Card.tsx"));
  });

  it("blocks traversal, absolutes, reserved paths and bad chars", () => {
    const hits = ingestProjectFiles([
      { path: "../etc/passwd", content: "root" },
      { path: "/etc/passwd", content: "root" },
      { path: "C:\\Windows\\win.ini", content: "ini" },
      { path: "//nas/share/x.js", content: "x" },
      { path: ".env", content: "XAI_API_KEY=no" },
      { path: "fenix.json", content: "{}" },
      { path: ".git/config", content: "x" },
      { path: "node_modules/x.js", content: "x" },
      { path: "ok.js", content: "console.log(1)" },
    ]);
    const reasons = hits.rejected.map((r) => r.reason);
    assert.ok(reasons.includes("traversal"));
    assert.ok(reasons.filter((r) => r === "percorso assoluto").length >= 2);
    assert.ok(reasons.includes("percorso riservato"));
    assert.equal(hits.files.map((f) => f.path).join(","), "ok.js");
    assert.equal(canonicalizePath("foo/../../secret").ok, false);
  });

  it("rejects case-insensitive collisions, binaries, secret-like and oversize", () => {
    const secret = ingestProjectFiles([
      { path: "css/App.css", content: "a{}" },
      { path: "css/app.css", content: "b{}" },
      { path: "bin.dat", content: "nope" },
      { path: "a.js", content: "hello\0world" },
      {
        path: "secrets.js",
        content: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      },
      { path: "tok.js", content: 'const t = "sk-abcdefghijk"' },
      { path: "ok.css", content: "body{margin:0}" },
    ]);
    const reasons = secret.rejected.map((r) => r.reason);
    assert.ok(reasons.includes("collisione"));
    assert.ok(reasons.includes("estensione non ammessa"));
    assert.ok(reasons.includes("binario"));
    assert.ok(reasons.includes("segreto"));
    assert.ok(secret.files.some((f) => f.path === "css/App.css"));
    assert.ok(secret.files.some((f) => f.path === "ok.css"));
    assert.equal(
      ingestProjectFiles([{ path: "big.md", content: "x".repeat(MAX_FILE_BYTES + 1) }]).rejected[0]
        ?.reason,
      "file troppo grande",
    );
  });

  it("counts UTF-8 bytes, not UTF-16 code units, at the file and tree boundary", () => {
    const e = "é";
    assert.equal(utf8Bytes(e), 2);
    assert.equal(e.length, 1);
    assert.equal(utf8Bytes("😀"), 4);
    const atFile = e.repeat(MAX_FILE_BYTES / 2);
    assert.equal(utf8Bytes(atFile), MAX_FILE_BYTES);
    assert.equal(atFile.length, MAX_FILE_BYTES / 2);
    assert.equal(ingestProjectFiles([{ path: "a.md", content: atFile }]).rejected.length, 0);
    assert.equal(
      ingestProjectFiles([{ path: "a.md", content: atFile + e }]).rejected[0]?.reason,
      "file troppo grande",
    );
    const chunk = e.repeat(MAX_FILE_BYTES / 2);
    const five = Array.from({ length: 5 }, (_, i) => ({ path: `f${i}.md`, content: chunk }));
    assert.equal(ingestProjectFiles(five).rejected.length, 0);
    assert.ok(utf8Bytes(chunk) * 5 < MAX_TREE_BYTES);
    assert.ok(utf8Bytes(chunk) * 6 > MAX_TREE_BYTES);
    const six = ingestProjectFiles([...five, { path: "overflow.md", content: chunk }]);
    assert.ok(six.rejected.some((r) => r.reason === "albero troppo grande"));
    const man = treeManifest([{ path: "note.md", content: "é😀" }]);
    assert.equal(man.files.find((f) => f.path === "note.md")?.bytes, utf8Bytes("é😀"));
    assert.notEqual(man.files.find((f) => f.path === "note.md")?.bytes, "é😀".length);
  });

  it("caps file count", () => {
    const input = Array.from({ length: MAX_PROJECT_FILES + 3 }, (_, i) => ({
      path: `f${i}.txt`,
      content: `n${i}`,
    }));
    const got = ingestProjectFiles(input);
    assert.equal(got.files.length, MAX_PROJECT_FILES);
    assert.ok(got.rejected.some((r) => r.reason === "limite file"));
  });

  it("parseProjectFiles drops blocked FILE blocks", () => {
    const text = `
<<<FILE path="../x.js">>>
alert(1)
<<<FILE path="css/theme.css">>>
body{margin:0}
<<<END>>>`;
    const files = parseProjectFiles(text);
    assert.deepEqual(
      files.map((f) => f.path),
      ["css/theme.css"],
    );
  });
});

describe("migration of HTML-only projects", () => {
  it("keeps Argilla Viva html, kind, storage and does not invent publish ids", () => {
    const persisted: Recoverable & { name: string } = {
      id: "argilla-viva",
      name: "Argilla Viva",
      status: "ready",
      kind: "dashboard",
      requestedKind: "dashboard",
      html: ARGILLA,
      appData: { argilla_viva: { items: [{ nome: "Ciotola" }] } },
      updatedAt: Date.now(),
    };
    const recovered = recoverPersistedProject(persisted);
    assert.equal(recovered.kind, "dashboard");
    assert.equal(recovered.name, "Argilla Viva");
    assert.equal(recovered.id, "argilla-viva");
    assert.ok(recovered.html.includes("Argilla Viva"));
    assert.deepEqual(recovered.appData, persisted.appData);
    assert.equal(recovered.files?.[0]?.path, ENTRYPOINT);
    assert.equal(recovered.files?.[0]?.content, recovered.html);
    const again = migrateProjectTree(recovered);
    assert.equal(again.files, recovered.files);
    assert.equal(recovered.publishedId, undefined);
  });
});

describe("file tree and authorized preview", () => {
  it("builds a nested tree and never executes extra paths", () => {
    const nodes = fileTree(SITE_MULTIFILE);
    const css = nodes.find((n) => n.kind === "dir" && n.name === "css");
    assert.ok(css && css.kind === "dir");
    assert.ok(css.children.some((c) => c.kind === "file" && c.path === "css/theme.css"));
    const html = authorizedPreviewHtml({ html: SITE_MULTIFILE[0]!.content, files: SITE_MULTIFILE });
    assert.equal(html, SITE_MULTIFILE[0]!.content);
    assert.doesNotMatch(html, /\.\.\/|fenix\.json|BEGIN PRIVATE/);
    const empty = authorizedPreviewHtml({
      files: [
        { path: "index.html", content: "<!doctype html><title>x</title>" },
        { path: "js/evil.js", content: "alert(1)" },
      ],
    });
    assert.match(empty, /doctype html/i);
    assert.doesNotMatch(empty, /alert\(1\)/);
  });

  it("bundles only explicitly referenced local CSS, JS and fetched data", () => {
    const source = `<!doctype html><html><head>
      <link rel="stylesheet" href="./css/app.css?v=1">
      <link rel="stylesheet" href="https://cdn.example.com/remote.css">
    </head><body><output id="result">attesa</output>
      <script src="./js/app.js"></script>
      <script src="../escape.js"></script>
    </body></html>`;
    const bundled = bundleProjectHtml([
      { path: "index.html", content: source },
      { path: "css/app.css", content: "body{color:#123456}" },
      {
        path: "js/app.js",
        content:
          "fetch('./data/items.json').then(r=>r.json()).then(x=>document.getElementById('result').textContent=x.items[0])",
      },
      { path: "data/items.json", content: '{"items":["Ciotola"]}' },
      { path: "js/unreferenced.js", content: "window.unreferencedRan=true" },
      { path: "escape.js", content: "window.escaped=true" },
    ]);
    assert.match(bundled, /data-fenix-file="css\/app\.css"/);
    assert.match(bundled, /body\{color:#123456\}/);
    assert.match(bundled, /data-fenix-file="js\/app\.js"/);
    assert.match(bundled, /data-fenix-tree-fetch/);
    assert.match(bundled, /Ciotola/);
    assert.match(bundled, /https:\/\/cdn\.example\.com\/remote\.css/);
    assert.match(bundled, /src="\.\.\/escape\.js"/);
    assert.doesNotMatch(bundled, /unreferencedRan/);
    assert.doesNotMatch(bundled, /window\.escaped=true/);
    assert.equal(authorizedPreviewHtml({ html: source, files: [] }), source);
  });
});

describe("ZIP round-trip", () => {
  it("packs the canonical tree plus reproducible fenix.json, no secrets", () => {
    const a = zipProject(SITE_MULTIFILE, { kind: "site" });
    const b = zipProject(SITE_MULTIFILE, { kind: "site" });
    assert.deepEqual([...a], [...b]);
    const round = unzipProject(a);
    assert.ok(round.manifest);
    assert.equal(round.manifest?.entrypoint, ENTRYPOINT);
    assert.equal(round.manifest?.kind, "site");
    assert.deepEqual(
      round.files.map((f) => f.path),
      projectFiles({ files: SITE_MULTIFILE }).map((f) => f.path),
    );
    assert.equal(
      round.files.find((f) => f.path === "css/theme.css")?.content,
      SITE_MULTIFILE.find((f) => f.path === "css/theme.css")?.content,
    );
    assert.equal(
      round.files.some((f) => f.path === "fenix.json"),
      false,
    );
    const text = new TextDecoder().decode(a);
    assert.match(text, /"entrypoint": "index.html"/);
    assert.doesNotMatch(text, /BEGIN PRIVATE|xai-|sk-abcdefgh/);
    assert.equal(
      treeManifest(SITE_MULTIFILE, { name: "xai-abcdefghijk" }).name,
      undefined,
    );
    const poisoned = unzipProject(
      zipProject([
        ...SITE_MULTIFILE,
        {
          path: "secret.pem",
          content: "-----BEGIN PRIVATE KEY-----\nno\n-----END PRIVATE KEY-----",
        },
      ]),
    );
    assert.equal(
      poisoned.files.some((f) => /\.pem$/i.test(f.path)),
      false,
    );
  });

  it("imports only a complete Fenix tree whose manifest matches every file", () => {
    const archive = zipProject(SITE_MULTIFILE, { kind: "site", name: "Onda Portatile" });
    const imported = importProjectArchive(archive);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    assert.equal(imported.manifest.name, "Onda Portatile");
    assert.equal(imported.manifest.kind, "site");
    assert.equal(imported.files.length, SITE_MULTIFILE.length);
    assert.deepEqual(
      imported.files.map((file) => file.path),
      projectFiles({ files: SITE_MULTIFILE }).map((file) => file.path),
    );
  });

  it("fails closed on corruption, unsupported ZIPs, traversal, extras and oversize", () => {
    const archive = zipProject(SITE_MULTIFILE, { kind: "site", name: "Onda" });
    const corrupted = archive.slice();
    const marker = new TextEncoder().encode("Onda");
    const at = corrupted.findIndex((value, index) =>
      marker.every((byte, offset) => corrupted[index + offset] === byte),
    );
    assert.ok(at > 0);
    corrupted[at] = corrupted[at]! ^ 1;
    const corruptResult = importProjectArchive(corrupted);
    assert.equal(corruptResult.ok, false);
    if (!corruptResult.ok) assert.match(corruptResult.error, /Checksum|Manifest/);

    const compressed = archive.slice();
    compressed[8] = 8;
    const compressedResult = importProjectArchive(compressed);
    assert.equal(compressedResult.ok, false);
    if (!compressedResult.ok) assert.match(compressedResult.error, /non è un export Fenix/);

    const manifest = treeManifest(SITE_MULTIFILE, { kind: "site" });
    const traversal = importProjectArchive(
      zipFiles([
        { path: "fenix.json", content: JSON.stringify(manifest) },
        ...SITE_MULTIFILE,
        { path: "../secret.js", content: "console.log('no')" },
      ]),
    );
    assert.equal(traversal.ok, false);
    if (!traversal.ok) assert.match(traversal.error, /File rifiutato: traversal/);

    const extra = importProjectArchive(
      zipFiles([
        { path: "fenix.json", content: JSON.stringify(manifest) },
        ...SITE_MULTIFILE,
        { path: "extra.txt", content: "not declared" },
      ]),
    );
    assert.equal(extra.ok, false);
    if (!extra.ok) assert.match(extra.error, /file non dichiarati/);

    const tooLarge = new Uint8Array(MAX_PROJECT_ARCHIVE_BYTES + 1);
    const largeResult = importProjectArchive(tooLarge);
    assert.equal(largeResult.ok, false);
    if (!largeResult.ok) assert.match(largeResult.error, /troppo grande/);
  });
});

describe("rollback photographs the whole tree", () => {
  it("restores extra files, not only html", () => {
    const now = 1_720_000_000_000;
    const base: Project = {
      id: "p-tree",
      name: "Onda",
      tagline: "Musica",
      prompt: "sito musica kind=site",
      kind: "site",
      requestedKind: "site",
      summary: "",
      palette: DEFAULT_PALETTE,
      html: SITE_MULTIFILE[0]!.content,
      files: SITE_MULTIFILE,
      messages: [{ id: "m", role: "user", content: "sk-hidden", at: now }],
      buildLog: [],
      status: "ready",
      createdAt: now,
      updatedAt: now,
    };
    let project = commitIfChanged(base, { source: "build", label: "Pronto", id: "old", at: 1 });
    const later = SITE_MULTIFILE.map((f) =>
      f.path === "css/theme.css" ? { ...f, content: "body{color:red}" } : f,
    );
    project = commitIfChanged(
      { ...project, html: `${project.html}<!-- v2 -->`, files: later, name: "Onda Live" },
      { source: "polish", label: "Rifinitura", id: "new", at: 2 },
    );
    const restored = restoreProjectRevision(project, "old");
    assert.ok(restored);
    assert.equal(
      restored!.files?.find((f) => f.path === "css/theme.css")?.content,
      SITE_MULTIFILE.find((f) => f.path === "css/theme.css")?.content,
    );
    assert.doesNotMatch(restored!.html, /<!-- v2 -->/);
    assert.equal(restored!.name, "Onda");
    const snap = JSON.stringify(restored!.revisions);
    assert.doesNotMatch(snap, /sk-hidden|visualJobId/);
  });
});

describe("desktop parse keeps portable src/ for export and rollback", () => {
  it("src/components survives parse -> store tree -> revision -> ZIP", () => {
    const card = APP_COMPONENTS.find((f) => f.path === "src/components/Card.tsx")!.content;
    const html = ARGILLA;
    const raw = `
<<<FILE path="src/components/Card.tsx">>>
${card}
<<<FILE path="screens/home.html">>>
<section>telefono</section>
<<<FILE path="data/ordini.json">>>
{"ok":true}
<<<END>>>`;
    const parsed = dropPhoneScreenFiles(parseProjectFiles(raw));
    const cardKept = parsed.find((f) => f.path === "src/components/Card.tsx")?.content;
    assert.ok(cardKept);
    assert.match(cardKept, /function Card/);
    assert.equal(
      parsed.some((f) => f.path === "screens/home.html"),
      false,
    );
    const stored = projectFiles({ html, files: parsed });
    assert.equal(stored.find((f) => f.path === "src/components/Card.tsx")?.content, cardKept);
    assert.equal(stored.find((f) => f.path === ENTRYPOINT)?.content, html);
    const now = 1_720_000_111_000;
    const project: Project = {
      id: "p-desk-tree",
      name: "Argilla Viva",
      tagline: "Magazzino",
      prompt: "FORMATO: gestionale. kind=dashboard",
      kind: "dashboard",
      requestedKind: "dashboard",
      summary: "",
      palette: DEFAULT_PALETTE,
      html,
      files: stored,
      messages: [],
      buildLog: ["Pronto"],
      status: "ready",
      createdAt: now,
      updatedAt: now,
    };
    const committed = commitIfChanged(project, {
      source: "build",
      label: "Pronto",
      id: "rev-desk",
      at: now,
    });
    assert.ok(committed.files?.some((f) => f.path === "src/components/Card.tsx"));
    const preview = authorizedPreviewHtml({ html: committed.html, files: committed.files });
    assert.equal(preview, committed.html);
    assert.doesNotMatch(preview, /export default function Card/);
    const zipped = zipProject(committed.files || [], { kind: "dashboard" });
    const round = unzipProject(zipped);
    assert.equal(round.files.find((f) => f.path === "src/components/Card.tsx")?.content, cardKept);
    const later = (committed.files || []).map((f) =>
      f.path === "src/components/Card.tsx"
        ? { ...f, content: "export default function Card(){return null}" }
        : f,
    );
    const polished = commitIfChanged(
      { ...committed, files: later, html: `${committed.html}<!-- v2 -->` },
      { source: "polish", label: "Rifinitura", id: "rev-desk-2", at: now + 1 },
    );
    const restored = restoreProjectRevision(polished, "rev-desk");
    assert.equal(
      restored!.files?.find((f) => f.path === "src/components/Card.tsx")?.content,
      cardKept,
    );
  });
});
