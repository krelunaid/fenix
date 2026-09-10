// Independent acceptance checks — things the generated project cannot vouch for
// itself. They never read the model's tests; they look at the files and poke the
// running server the way a hostile or clumsy user would. Each returns
// { id, ok, detail } entries that checks.mjs appends to the gate.
import { isTextPath } from "./contract.mjs";

// Pictographic emoji (not digits/symbols like ©): the UI must use SVG icons.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{1F000}-\u{1F2FF}]️?/u;

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
}

/** Static UI checks on one HTML document. Returns a list of problems (empty = ok). */
export function auditHtml(html, { path = "" } = {}) {
  const problems = [];
  const body = stripComments(html);
  const text = body.replace(/<[^>]+>/g, " ");
  const emoji = text.match(EMOJI_RE) || body.match(/(?:aria-label|title|placeholder|alt|value)\s*=\s*"[^"]*[\u{1F300}-\u{1FAFF}]/u);
  if (emoji) problems.push(`emoji usata come icona ("${String(emoji[0]).slice(-2)}") — usa il tool icons`);

  const h1 = (body.match(/<h1[\s>]/gi) || []).length;
  if (h1 !== 1) problems.push(`${h1} <h1> (ne serve esattamente uno)`);

  // Labels: every visible form control must be labelled.
  const labelFor = new Set([...body.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));
  const wrapped = new Set();
  for (const m of body.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)) {
    for (const c of m[1].matchAll(/<(?:input|select|textarea)\b[^>]*\bid\s*=\s*["']([^"']+)["']/gi)) wrapped.add(c[1]);
  }
  let unlabelled = 0;
  for (const m of body.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = m[0];
    const type = (attr(tag, "type") || "").toLowerCase();
    if (m[1].toLowerCase() === "input" && ["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
    const id = attr(tag, "id");
    const ok = (id && (labelFor.has(id) || wrapped.has(id))) || attr(tag, "aria-label") || attr(tag, "aria-labelledby") || /<label\b[^>]*>[^<]*$/i.test(body.slice(Math.max(0, m.index - 200), m.index));
    if (!ok) unlabelled += 1;
  }
  if (unlabelled) problems.push(`${unlabelled} campi senza <label>`);

  let mute = 0;
  for (const m of body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const inner = m[2].replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/<[^>]+>/g, "").trim();
    if (!inner && !attr(`<button${m[1]}>`, "aria-label") && !attr(`<button${m[1]}>`, "title")) mute += 1;
  }
  if (mute) problems.push(`${mute} <button> senza testo né aria-label`);

  let noAlt = 0;
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) if (attr(m[0], "alt") === null) noAlt += 1;
  if (noAlt) problems.push(`${noAlt} <img> senza alt`);

  if (/<a\b[^>]*href\s*=\s*["']#["'][^>]*>/i.test(body)) problems.push('link con href="#" (bottone finto)');
  if (/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']https?:\/\/(?!fonts\.googleapis\.com|fonts\.gstatic\.com)/i.test(html)) problems.push("script/CSS esterni non consentiti");
  // A return directly inside an inline module is a SyntaxError in browsers. This
  // pattern is a common but invalid authentication guard produced by models.
  if (/<script\b[^>]*type\s*=\s*["']module["'][^>]*>[\s\S]*?if\s*\(\s*!\s*requireAuth\s*\(\s*\)\s*\)\s*\{\s*return\s*;/i.test(html)) {
    problems.push("return al livello principale del modulo: racchiudi l'avvio pagina in una funzione async");
  }
  return problems.map((p) => (path ? `${path}: ${p}` : p));
}

/** Static checks on server source: parameterized SQL, no eval, sqlite actually used. */
export function auditServer(source) {
  const problems = [];
  if (!/node:sqlite/.test(source)) problems.push("server.mjs non usa node:sqlite (i dati non sopravvivono al riavvio)");
  if (/\b(?:prepare|exec|run|get|all)\(\s*`[^`]*\$\{/.test(source) || /\b(?:prepare|exec)\(\s*(?:"[^"]*"|'[^']*')\s*\+\s*[A-Za-z_]/.test(source)) {
    problems.push("SQL costruito con concatenazione/template di variabili: usa parametri (?)");
  }
  if (/\beval\(|new Function\(/.test(source)) problems.push("eval/new Function nel server");
  if (/child_process/.test(source)) problems.push("child_process nel server");
  const storesPlainPassword = /\bpassword\s+(?:text|varchar|char)\b/i.test(source)
    || /\b(?:where|and)\b[^;\n]{0,240}\bpassword\s*=\s*\?/i.test(source)
    || /insert\s+into\s+[\w"`]+\s*\([^)]*\bpassword\b/i.test(source);
  if (storesPlainPassword) problems.push("password in chiaro nel database/query: salva password_hash con crypto.scrypt e confronta con timingSafeEqual");
  return problems;
}

/**
 * Dynamic checks against a running server: traversal, malformed JSON, method
 * handling. `fetch(path, init)` is the sandbox relay.
 */
export async function probeServer(fetch, manifest) {
  const problems = [];
  const safe = async (path, init) => { try { return await fetch(path, init); } catch (err) { return { status: 0, text: String(err?.message || err), headers: {} }; } };

  for (const p of ["/../../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd", "/..%2fserver.mjs", "/public/../server.mjs", "/%2e%2e%2fserver.mjs"]) {
    const r = await safe(p);
    if (r.status === 200 && (/root:x:|createServer|node:sqlite|DatabaseSync/.test(r.text))) problems.push(`traversal: GET ${p} -> 200 con contenuto sensibile`);
    else if (r.status >= 500 || r.status === 0) problems.push(`traversal: GET ${p} -> ${r.status || "errore"}`);
  }
  for (const p of ["/server.mjs", "/package.json", "/fenix.project.json", "/data/app.db", "/.fenix/data/app.db", "/tests/"]) {
    const r = await safe(p);
    if (r.status === 200 && !/text\/html/i.test(r.headers["content-type"] || "")) problems.push(`file del progetto servito pubblicamente: GET ${p} -> 200`);
  }

  const writes = (manifest.api || []).filter((r) => /^(POST|PUT|PATCH)$/i.test(r.method));
  for (const route of writes.slice(0, 6)) {
    const path = route.path.replace(/:[A-Za-z_]+/g, "1");
    const bad = await safe(path, { method: route.method.toUpperCase(), headers: { "content-type": "application/json" }, body: "{not json" });
    if (bad.status !== 400 && bad.status !== 415 && bad.status !== 422) problems.push(`${route.method} ${route.path} con JSON rotto -> ${bad.status} (atteso 400)`);
    const huge = await safe(path, { method: route.method.toUpperCase(), headers: { "content-type": "application/json" }, body: JSON.stringify({ x: "a".repeat(600_000) }) });
    // A server may cut the socket while the client is still sending (status 0): fine, as long as it is alive afterwards.
    if (huge.status >= 500) problems.push(`${route.method} ${route.path} con body da 600 KB -> ${huge.status} (atteso 400/413)`);
  }
  const wrong = await safe("/health", { method: "DELETE" });
  if (wrong.status >= 500 || wrong.status === 0) problems.push(`DELETE /health -> ${wrong.status || "crash"} (atteso 404/405)`);
  let health = { status: 0 };
  for (let i = 0; i < 4 && health.status !== 200; i += 1) {
    if (i) await new Promise((r) => setTimeout(r, 250));
    health = await safe("/health");
  }
  if (health.status !== 200) problems.push(`il server non risponde più a /health dopo le richieste ostili (${health.status || "connessione rifiutata"})`);
  return problems;
}

/**
 * Persistence: boot on a data dir, boot again on the same dir, and make sure a
 * database file actually landed there. `spawn(env)` starts the server and returns
 * { ok, error, logs }, `stop()` stops it, `listData()` lists files in the data dir.
 */
export async function probePersistence({ spawn, stop, fetch, listData, manifest }) {
  const problems = [];
  const first = await spawn();
  if (!first.ok) return [`primo avvio fallito: ${first.error}`];
  const before = {};
  for (const route of (manifest.api || []).filter((r) => /^GET$/i.test(r.method))) {
    const path = route.path.replace(/:[A-Za-z_]+/g, "1");
    try { const r = await fetch(path); before[path] = `${r.status} ${r.text.slice(0, 2000)}`; } catch { /* ignore */ }
  }
  await stop();
  const files = await listData();
  if (!files.some((f) => /\.(db|sqlite|sqlite3)$/i.test(f))) problems.push(`nessun file .db in DATA_DIR dopo l'avvio (trovati: ${files.slice(0, 5).join(", ") || "nessuno"})`);
  const second = await spawn();
  if (!second.ok) {
    problems.push(`secondo avvio sullo stesso DATA_DIR fallito (schema non idempotente?): ${second.error}\n${(second.logs || "").slice(-600)}`);
    return problems;
  }
  try {
    for (const [path, expected] of Object.entries(before)) {
      try {
        const r = await fetch(path);
        const got = `${r.status} ${r.text.slice(0, 2000)}`;
        if (got !== expected) problems.push(`GET ${path} cambia dopo il riavvio (${expected.slice(0, 60)} → ${got.slice(0, 60)})`);
      } catch (err) { problems.push(`GET ${path} dopo il riavvio: ${err?.message || err}`); }
    }
  } finally {
    await stop();
  }
  return problems;
}

/** Which project files to audit statically. */
export function auditableFiles(files) {
  return files.filter((f) => isTextPath(f.path) && /^public\/.*\.html$/.test(f.path));
}
