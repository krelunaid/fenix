import { test } from "node:test";
import assert from "node:assert/strict";
import { auditHtml, auditServer, probeServer, probePersistence } from "../workers/agent/acceptance.mjs";
import { runChecks } from "../workers/agent/checks.mjs";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";

test("auditHtml flags emoji icons, missing labels, mute buttons, fake links, external scripts", () => {
  const good = GOLDEN_FILES.find((f) => f.path === "public/index.html").content;
  assert.deepEqual(auditHtml(good), []);
  const bad = `<!doctype html><html lang="it"><body><main>
    <h1>Uno</h1><h1>Due</h1>
    <nav><a href="/">🏠 Home</a><a href="#">Altro</a></nav>
    <form><input name="nome"><select name="x"><option>1</option></select><button><svg></svg></button><input type="submit" value="Invia"></form>
    <img src="/a.png">
    <script src="https://cdn.example.com/x.js"></script>
  </main></body></html>`;
  const problems = auditHtml(bad, { path: "public/x.html" });
  assert.ok(problems.some((p) => /emoji/.test(p)), problems.join("\n"));
  assert.ok(problems.some((p) => /2 <h1>/.test(p)));
  assert.ok(problems.some((p) => /2 campi senza <label>/.test(p)));
  assert.ok(problems.some((p) => /<button> senza testo/.test(p)));
  assert.ok(problems.some((p) => /<img> senza alt/.test(p)));
  assert.ok(problems.some((p) => /href="#"/.test(p)));
  assert.ok(problems.some((p) => /esterni/.test(p)));
  assert.ok(problems.every((p) => p.startsWith("public/x.html: ")));
  // Labelled variants are accepted: for/id, wrapping, aria-label; Google Fonts allowed; © is not an emoji.
  const ok = `<!doctype html><html lang="it"><head><link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet"></head><body><main><h1>Ok</h1>
    <label for="a">A</label><input id="a"><label>B <input id="b"></label><input aria-label="C"><button aria-label="Chiudi"><svg></svg></button>
    <footer>© 2026</footer></main></body></html>`;
  assert.deepEqual(auditHtml(ok), []);
});

test("auditServer flags concatenated SQL, missing sqlite, eval and child_process", () => {
  assert.deepEqual(auditServer(GOLDEN_FILES.find((f) => f.path === "server.mjs").content), []);
  const bad = 'import { DatabaseSync } from "node:sqlite"; db.prepare(`SELECT * FROM t WHERE id = ${id}`); eval(x); import cp from "node:child_process";';
  const p = auditServer(bad);
  assert.ok(p.some((x) => /concatenazione/.test(x)));
  assert.ok(p.some((x) => /eval/.test(x)));
  assert.ok(p.some((x) => /child_process/.test(x)));
  assert.ok(auditServer("const data = []; // in memory").some((x) => /node:sqlite/.test(x)));
  assert.ok(auditServer('db.exec("SELECT * FROM t WHERE nome = \'" + nome + "\'")').some((x) => /concatenazione/.test(x)));
});

test("probeServer catches traversal, leaked project files, crashes on bad JSON", async () => {
  const manifest = { api: [{ method: "POST", path: "/api/x" }] };
  const naive = async (path, init = {}) => {
    if (path.includes("etc/passwd")) return { status: 200, headers: { "content-type": "text/plain" }, text: "root:x:0:0" };
    if (path === "/server.mjs") return { status: 200, headers: { "content-type": "application/javascript" }, text: "createServer()" };
    if (init.method === "POST" && init.body === "{not json") return { status: 500, headers: {}, text: "SyntaxError" };
    return { status: 200, headers: { "content-type": "application/json" }, text: "{\"ok\":true}" };
  };
  const problems = await probeServer(naive, manifest);
  assert.ok(problems.some((p) => /traversal/.test(p)), problems.join("\n"));
  assert.ok(problems.some((p) => /servito pubblicamente: GET \/server\.mjs/.test(p)));
  assert.ok(problems.some((p) => /JSON rotto -> 500/.test(p)));
  const solid = async (path, init = {}) => {
    if (path === "/health" && (!init.method || init.method === "GET")) return { status: 200, headers: { "content-type": "application/json" }, text: "{\"ok\":true}" };
    if (init.method === "POST") return init.body === "{not json" || init.body.length > 100_000 ? { status: 400, headers: {}, text: "" } : { status: 201, headers: {}, text: "" };
    return { status: 404, headers: { "content-type": "text/html" }, text: "<h1>404</h1>" };
  };
  assert.deepEqual(await probeServer(solid, manifest), []);
});

test("probePersistence detects in-memory storage and non-idempotent schema", async () => {
  const manifest = { api: [{ method: "GET", path: "/api/items" }] };
  let boots = 0;
  const memory = await probePersistence({
    manifest,
    spawn: async () => { boots += 1; return { ok: true }; },
    stop: async () => {},
    fetch: async () => ({ status: 200, text: boots === 1 ? "[1]" : "[]" }),
    listData: async () => ["cache.json"],
  });
  assert.ok(memory.some((p) => /nessun file \.db/.test(p)), memory.join("\n"));
  assert.ok(memory.some((p) => /cambia dopo il riavvio/.test(p)));
  let n = 0;
  const brokenSchema = await probePersistence({
    manifest,
    spawn: async () => (++n === 1 ? { ok: true } : { ok: false, error: "table already exists", logs: "SqliteError: table items already exists" }),
    stop: async () => {},
    fetch: async () => ({ status: 200, text: "[]" }),
    listData: async () => ["app.db"],
  });
  assert.ok(brokenSchema.some((p) => /secondo avvio/.test(p)));
});

test("runChecks gates on the independent checks: an emoji tab bar and a leaky static server fail", { timeout: 120_000 }, async () => {
  const sandbox = await LocalSandbox.create({ jobId: `accept-${process.pid}` });
  try {
    for (const f of GOLDEN_FILES) await sandbox.writeFile(f.path, f.content);
    const clean = await runChecks(sandbox, { browser: false });
    for (const id of ["ui:static", "server:static", "security:probe", "persistence"]) {
      const c = clean.checks.find((x) => x.id === id);
      assert.ok(c && c.ok, `${id} doveva passare sul golden: ${c?.detail}`);
    }
    const html = GOLDEN_FILES.find((f) => f.path === "public/index.html").content.replace('<a href="/" aria-current="page">Agenda</a>', '<a href="/" aria-current="page">📅 Agenda</a>');
    await sandbox.writeFile("public/index.html", html);
    const dirty = await runChecks(sandbox, { browser: false });
    const ui = dirty.checks.find((x) => x.id === "ui:static");
    assert.equal(ui.ok, false);
    assert.match(ui.detail, /emoji/);
    assert.equal(dirty.ok, false);
  } finally {
    await sandbox.destroy();
  }
});
