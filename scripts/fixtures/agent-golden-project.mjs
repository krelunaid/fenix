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
<link rel="stylesheet" href="/fenix-ui.css">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="fx-app">
<nav class="fx-tabbar" aria-label="Sezioni">
  <a class="fx-brand fx-hide-phone" href="/"><span class="fx-logo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg></span><span>Barbiere Rossi</span></a>
  <a class="fx-tab" href="/" aria-current="page"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg><span>Agenda</span></a>
  <a class="fx-tab" href="/clienti"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg><span>Clienti</span></a>
</nav>
<div class="fx-body">
<header class="fx-header"><div><h1 class="fx-h1">Agenda di oggi</h1><p class="fx-small fx-muted">Barbiere Rossi · via Roma 12, Bari</p></div></header>
<main class="fx-main" id="main">
  <section class="fx-card fx-section" aria-labelledby="nuovo">
    <h2 id="nuovo" class="fx-h3">Nuovo appuntamento</h2>
    <form id="form" class="fx-form" novalidate>
      <div class="fx-field">
        <label class="fx-label" for="cliente">Cliente</label>
        <input class="fx-input" id="cliente" name="cliente" required minlength="2" autocomplete="name" placeholder="Nome e cognome">
      </div>
      <div class="fx-field">
        <label class="fx-label" for="servizio">Servizio</label>
        <select class="fx-select" id="servizio" name="servizio" required>
          <option>Taglio</option><option>Barba</option><option>Taglio e barba</option>
        </select>
      </div>
      <div class="fx-field">
        <label class="fx-label" for="quando">Quando</label>
        <input class="fx-input" id="quando" name="quando" type="datetime-local" required>
      </div>
      <button class="fx-btn fx-btn-block" type="submit">Prenota</button>
      <p id="esito" class="esito fx-small" role="status" aria-live="polite"></p>
    </form>
  </section>
  <section class="fx-section" aria-labelledby="elenco">
    <div class="fx-section-title"><h2 id="elenco" class="fx-h3">Prossimi appuntamenti</h2></div>
    <ul id="lista" class="fx-list"><li class="fx-empty vuoto">Carico l'agenda…</li></ul>
  </section>
</main>
</div>
</div>
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
<link rel="stylesheet" href="/fenix-ui.css">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="fx-app">
<nav class="fx-tabbar" aria-label="Sezioni">
  <a class="fx-brand fx-hide-phone" href="/"><span class="fx-logo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg></span><span>Barbiere Rossi</span></a>
  <a class="fx-tab" href="/"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg><span>Agenda</span></a>
  <a class="fx-tab" href="/clienti" aria-current="page"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg><span>Clienti</span></a>
</nav>
<div class="fx-body">
<header class="fx-header"><div><h1 class="fx-h1">Clienti</h1><p class="fx-small fx-muted">Chi è passato dal negozio, ordinato per ultima visita</p></div></header>
<main class="fx-main" id="main">
  <section class="fx-section" aria-labelledby="clienti">
    <h2 id="clienti" class="fx-h3">Elenco clienti</h2>
    <p class="fx-muted">Qui trovi i clienti ricavati dagli appuntamenti: nome, numero di visite e ultimo servizio. Aggiungi un appuntamento dall'agenda per vedere comparire un nuovo cliente in questa lista.</p>
    <ul id="lista" class="fx-list"><li class="fx-empty vuoto">Carico i clienti…</li></ul>
  </section>
</main>
</div>
</div>
<script type="module" src="/app.js"></script>
</body>
</html>
`,
  },
  {
    path: "public/404.html",
    content: `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pagina non trovata</title><link rel="stylesheet" href="/fenix-ui.css"><link rel="stylesheet" href="/styles.css"></head><body><div class="fx-app"><div class="fx-body"><main id="main" class="fx-main"><div class="fx-empty"><h1 class="fx-h3">Pagina non trovata</h1><p>Il percorso che hai aperto non esiste. Torna all'agenda per continuare a lavorare sugli appuntamenti di oggi.</p><a class="fx-btn" href="/">Vai all'agenda</a></div></main></div></div></body></html>
`,
  },
  {
    path: "public/styles.css",
    content: `:root { --fx-bg:#f6f1ea; --fx-surface:#fff; --fx-surface-2:#efe7dd; --fx-ink:#1f1a17; --fx-ink-2:#4a423d; --fx-muted:#6b625c; --fx-line:#e6ddd3; --fx-line-strong:#d3c6b8; --fx-accent:#7a3b2e; --fx-accent-ink:#fff; --fx-accent-soft:#f3e4de; --fx-focus:#d9a066; }
.esito { min-height: 1.4em; color: var(--fx-accent); }
.fx-list li.appuntamento { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; background: var(--fx-surface); border: 1px solid var(--fx-line); border-radius: var(--fx-radius); }
.fx-list li.appuntamento small { color: var(--fx-muted); display: block; }
.fx-list li .visite { color: var(--fx-muted); font-size: 14px; white-space: nowrap; }
.fx-list .vuoto { color: var(--fx-muted); }
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
  if (!items.length) { lista.innerHTML = '<li class="fx-empty vuoto"><strong class="fx-h3">Nessun appuntamento</strong><p>Prenota il primo dal modulo qui sopra.</p></li>'; return; }
  for (const a of items) {
    const li = document.createElement("li");
    li.className = "appuntamento";
    const testo = document.createElement("div");
    testo.innerHTML = "<strong></strong><small></small>";
    testo.querySelector("strong").textContent = a.cliente;
    testo.querySelector("small").textContent = a.servizio + " · " + fmt.format(new Date(a.quando));
    const btn = document.createElement("button");
    btn.className = "fx-btn fx-btn-secondary fx-btn-s"; btn.type = "button"; btn.textContent = "Annulla";
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
  if (!byName.size) { lista.innerHTML = '<li class="fx-empty vuoto"><strong class="fx-h3">Ancora nessun cliente</strong><p>Prenota un appuntamento dall\\'agenda e comparirà qui.</p></li>'; return; }
  for (const c of byName.values()) {
    const li = document.createElement("li");
    li.className = "appuntamento";
    li.innerHTML = "<div><strong></strong><small></small></div><span class=\\"visite\\"></span>";
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
