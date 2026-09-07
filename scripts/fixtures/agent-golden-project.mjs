// A minimal but real Fenix Project v1: agenda for a barber. Used by the agent
// tests as the "model output" and by the checks tests as a known-good tree.
export const GOLDEN_FILES = [
  {
    path: "fenix.project.json",
    content: JSON.stringify({
      version: 1,
      name: "Agenda Barbiere",
      kind: "app",
      start: "node server.mjs",
      healthPath: "/health",
      pages: [
        { path: "/", title: "Agenda" },
        { path: "/clienti", title: "Clienti" },
      ],
      api: [
        { method: "GET", path: "/api/appuntamenti" },
        { method: "POST", path: "/api/appuntamenti" },
      ],
    }, null, 2),
  },
  {
    path: "package.json",
    content: JSON.stringify({ name: "agenda-barbiere", private: true, type: "module", scripts: { start: "node server.mjs", test: "node --test tests/*.test.mjs" } }, null, 2),
  },
  {
    path: "server.mjs",
    content: `import { createServer as createHttpServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = fileURLToPath(new URL("./", import.meta.url));
const PUBLIC = join(ROOT, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

export function openDb(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, "app.db"));
  db.exec(\`CREATE TABLE IF NOT EXISTS appuntamenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL,
    servizio TEXT NOT NULL,
    quando TEXT NOT NULL,
    stato TEXT NOT NULL DEFAULT 'prenotato',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )\`);
  return db;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw new Error("troppo grande"); }
  return raw ? JSON.parse(raw) : {};
}

function validate(input) {
  const errors = [];
  const cliente = String(input.cliente || "").trim();
  const servizio = String(input.servizio || "").trim();
  const quando = String(input.quando || "").trim();
  if (cliente.length < 2) errors.push("Inserisci il nome del cliente.");
  if (!["Taglio", "Barba", "Taglio e barba"].includes(servizio)) errors.push("Scegli un servizio valido.");
  if (Number.isNaN(Date.parse(quando))) errors.push("Data e ora non valide.");
  return { errors, value: { cliente, servizio, quando } };
}

async function serveStatic(pathname, res) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const target = resolve(PUBLIC, "." + normalize(rel));
  if (!target.startsWith(PUBLIC)) return false;
  let file = target;
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, "index.html");
  } catch {
    if (!extname(file)) file = file + ".html"; else return false;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

export function createServer({ dataDir = process.env.DATA_DIR || join(ROOT, "data") } = {}) {
  const db = openDb(dataDir);
  const list = db.prepare("SELECT * FROM appuntamenti ORDER BY quando ASC");
  const insert = db.prepare("INSERT INTO appuntamenti (cliente, servizio, quando) VALUES (?, ?, ?)");
  const byId = db.prepare("SELECT * FROM appuntamenti WHERE id = ?");
  const del = db.prepare("DELETE FROM appuntamenti WHERE id = ?");
  const server = createHttpServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://local");
    try {
      if (url.pathname === "/health") return sendJson(res, 200, { ok: true });
      if (url.pathname === "/api/appuntamenti" && req.method === "GET") return sendJson(res, 200, list.all());
      if (url.pathname === "/api/appuntamenti" && req.method === "POST") {
        let input;
        try { input = await readJson(req); } catch { return sendJson(res, 400, { errors: ["JSON non valido."] }); }
        const { errors, value } = validate(input);
        if (errors.length) return sendJson(res, 400, { errors });
        const info = insert.run(value.cliente, value.servizio, value.quando);
        return sendJson(res, 201, byId.get(Number(info.lastInsertRowid)));
      }
      const m = url.pathname.match(/^\\/api\\/appuntamenti\\/(\\d+)$/);
      if (m && req.method === "DELETE") {
        const info = del.run(Number(m[1]));
        return info.changes ? sendJson(res, 204, {}) : sendJson(res, 404, { errors: ["Appuntamento non trovato."] });
      }
      if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { errors: ["Rotta non trovata."] });
      if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { errors: ["Metodo non consentito."] });
      if (await serveStatic(url.pathname, res)) return;
      const notFound = await readFile(join(PUBLIC, "404.html")).catch(() => "<!doctype html><title>Non trovata</title><h1>Pagina non trovata</h1>");
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(notFound);
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { errors: ["Errore interno."] });
    }
  });
  server.on("close", () => db.close());
  return server;
}

export function startServer({ port = Number(process.env.PORT || 3000), host = process.env.HOST || "127.0.0.1", dataDir } = {}) {
  const server = createServer({ dataDir });
  return new Promise((resolveStart) => server.listen(port, host, () => resolveStart(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer();
  const { port } = server.address();
  console.log(\`Agenda Barbiere su http://127.0.0.1:\${port}\`);
}
`,
  },
  {
    path: "public/index.html",
    content: `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Agenda · Barbiere Rossi</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="top"><h1>Agenda di oggi</h1><p class="sub">Barbiere Rossi · via Roma 12, Bari</p></header>
<main id="main">
  <section class="card" aria-labelledby="nuovo">
    <h2 id="nuovo">Nuovo appuntamento</h2>
    <form id="form" novalidate>
      <label for="cliente">Cliente</label>
      <input id="cliente" name="cliente" required minlength="2" autocomplete="name" placeholder="Nome e cognome">
      <label for="servizio">Servizio</label>
      <select id="servizio" name="servizio" required>
        <option>Taglio</option><option>Barba</option><option>Taglio e barba</option>
      </select>
      <label for="quando">Quando</label>
      <input id="quando" name="quando" type="datetime-local" required>
      <button type="submit">Prenota</button>
      <p id="esito" class="esito" role="status" aria-live="polite"></p>
    </form>
  </section>
  <section class="card" aria-labelledby="elenco">
    <h2 id="elenco">Prossimi appuntamenti</h2>
    <ul id="lista" class="lista"><li class="vuoto">Carico l'agenda…</li></ul>
  </section>
</main>
<nav class="tabbar" aria-label="Sezioni">
  <a href="/" aria-current="page">Agenda</a>
  <a href="/clienti">Clienti</a>
</nav>
<script type="module" src="/app.js"></script>
</body>
</html>
`,
  },
  {
    path: "public/clienti.html",
    content: `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Clienti · Barbiere Rossi</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="top"><h1>Clienti</h1><p class="sub">Chi è passato dal negozio, ordinato per ultima visita</p></header>
<main id="main">
  <section class="card" aria-labelledby="clienti">
    <h2 id="clienti">Elenco clienti</h2>
    <p>Qui trovi i clienti ricavati dagli appuntamenti: nome, numero di visite e ultimo servizio. Aggiungi un appuntamento dall'agenda per vedere comparire un nuovo cliente in questa lista.</p>
    <ul id="lista" class="lista"><li class="vuoto">Carico i clienti…</li></ul>
  </section>
</main>
<nav class="tabbar" aria-label="Sezioni">
  <a href="/">Agenda</a>
  <a href="/clienti" aria-current="page">Clienti</a>
</nav>
<script type="module" src="/app.js"></script>
</body>
</html>
`,
  },
  {
    path: "public/404.html",
    content: `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pagina non trovata</title><link rel="stylesheet" href="/styles.css"></head><body><main id="main" class="card"><h1>Pagina non trovata</h1><p>Il percorso che hai aperto non esiste. Torna all'<a href="/">agenda</a>.</p></main></body></html>
`,
  },
  {
    path: "public/styles.css",
    content: `:root { --bg:#f6f1ea; --card:#fff; --ink:#1f1a17; --muted:#6b625c; --accent:#7a3b2e; --line:#e6ddd3; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.45 -apple-system, system-ui, "Segoe UI", sans-serif; }
.top { padding: calc(env(safe-area-inset-top) + 20px) 20px 8px; }
h1 { margin: 0; font-size: 28px; letter-spacing: -0.01em; }
h2 { margin: 0 0 12px; font-size: 19px; }
.sub { margin: 4px 0 0; color: var(--muted); }
main { display: grid; gap: 16px; padding: 12px 16px calc(env(safe-area-inset-bottom) + 84px); max-width: 720px; margin: 0 auto; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
label { display: block; font-size: 15px; color: var(--muted); margin: 12px 0 6px; }
input, select, button { width: 100%; min-height: 48px; font: inherit; font-size: 16px; border-radius: 12px; border: 1px solid var(--line); padding: 0 14px; background: #fff; color: inherit; }
button { margin-top: 16px; background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; cursor: pointer; }
button:focus-visible, input:focus-visible, select:focus-visible, a:focus-visible { outline: 3px solid #d9a066; outline-offset: 2px; }
.esito { min-height: 1.4em; margin: 10px 0 0; color: var(--accent); }
.lista { list-style: none; margin: 0; padding: 0; }
.lista li { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
.lista li:first-child { border-top: 0; }
.lista .vuoto { color: var(--muted); }
.lista small { color: var(--muted); display: block; }
.lista button.rimuovi { width: auto; min-height: 44px; margin: 0; background: transparent; color: var(--accent); border: 1px solid var(--line); padding: 0 12px; }
.tabbar { position: fixed; inset: auto 0 0; display: flex; background: #fff; border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
.tabbar a { flex: 1; text-align: center; padding: 14px 0; min-height: 56px; color: var(--muted); text-decoration: none; font-weight: 600; }
.tabbar a[aria-current="page"] { color: var(--accent); }
@media (min-width: 900px) { main { grid-template-columns: 1fr 1fr; align-items: start; max-width: 1040px; } .tabbar { position: static; max-width: 1040px; margin: 0 auto; border: 0; background: transparent; } }
`,
  },
  {
    path: "public/app.js",
    content: `const fmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const lista = document.getElementById("lista");
const form = document.getElementById("form");
const esito = document.getElementById("esito");
const isClienti = location.pathname.startsWith("/clienti");

async function carica() {
  const res = await fetch("/api/appuntamenti");
  const items = await res.json();
  if (isClienti) return renderClienti(items);
  renderAgenda(items);
}

function renderAgenda(items) {
  lista.innerHTML = "";
  if (!items.length) { lista.innerHTML = '<li class="vuoto">Nessun appuntamento: prenota il primo qui sopra.</li>'; return; }
  for (const a of items) {
    const li = document.createElement("li");
    const testo = document.createElement("div");
    testo.innerHTML = "<strong></strong><small></small>";
    testo.querySelector("strong").textContent = a.cliente;
    testo.querySelector("small").textContent = a.servizio + " · " + fmt.format(new Date(a.quando));
    const btn = document.createElement("button");
    btn.className = "rimuovi"; btn.type = "button"; btn.textContent = "Annulla";
    btn.setAttribute("aria-label", "Annulla appuntamento di " + a.cliente);
    btn.addEventListener("click", async () => { await fetch("/api/appuntamenti/" + a.id, { method: "DELETE" }); carica(); });
    li.append(testo, btn);
    lista.append(li);
  }
}

function renderClienti(items) {
  const byName = new Map();
  for (const a of items) {
    const c = byName.get(a.cliente) || { nome: a.cliente, visite: 0, ultimo: a };
    c.visite += 1; c.ultimo = a; byName.set(a.cliente, c);
  }
  lista.innerHTML = "";
  if (!byName.size) { lista.innerHTML = '<li class="vuoto">Ancora nessun cliente. Prenota un appuntamento dall\\'agenda.</li>'; return; }
  for (const c of byName.values()) {
    const li = document.createElement("li");
    li.innerHTML = "<div><strong></strong><small></small></div><span></span>";
    li.querySelector("strong").textContent = c.nome;
    li.querySelector("small").textContent = "Ultimo: " + c.ultimo.servizio;
    li.querySelector("span").textContent = c.visite + (c.visite === 1 ? " visita" : " visite");
    lista.append(li);
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  esito.textContent = "";
  const body = Object.fromEntries(new FormData(form));
  const res = await fetch("/api/appuntamenti", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) { esito.textContent = (data.errors || ["Errore"]).join(" "); return; }
  esito.textContent = "Prenotato " + data.cliente + " per " + fmt.format(new Date(data.quando)) + ".";
  form.reset();
  carica();
});

carica();
`,
  },
  {
    path: "tests/app.test.mjs",
    content: `import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../server.mjs";

let server, base, dir;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "agenda-"));
  server = await startServer({ port: 0, dataDir: dir });
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => { await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); });

test("health", async () => {
  const res = await fetch(base + "/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("pagine", async () => {
  for (const p of ["/", "/clienti"]) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get("content-type"), /text\\/html/);
    assert.match(await res.text(), /<main/);
  }
  assert.equal((await fetch(base + "/non-esiste")).status, 404);
  assert.equal((await fetch(base + "/../server.mjs")).status, 404);
});

test("api: validazione, creazione, persistenza, cancellazione", async () => {
  const bad = await fetch(base + "/api/appuntamenti", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cliente: "A" }) });
  assert.equal(bad.status, 400);
  assert.ok((await bad.json()).errors.length >= 2);
  const ok = await fetch(base + "/api/appuntamenti", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cliente: "Mario Bianchi", servizio: "Taglio", quando: "2026-09-10T10:30" }) });
  assert.equal(ok.status, 201);
  const created = await ok.json();
  const list = await (await fetch(base + "/api/appuntamenti")).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].cliente, "Mario Bianchi");
  assert.equal((await fetch(base + "/api/appuntamenti/" + created.id, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(base + "/api/appuntamenti/" + created.id, { method: "DELETE" })).status, 404);
});
`,
  },
];
