// Deterministic acceptance checks. The agent cannot "finish" until they pass.
// Every check produces { id, ok, detail } so the model gets precise feedback and
// the user gets a verifiable receipt (no LLM judgement involved here).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MANIFEST_PATH, parseManifest, checkProjectSize, isTextPath } from "./contract.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SMOKE_SRC = join(HERE, "runtime", "browser-smoke.mjs");

const PLACEHOLDERS = [/lorem ipsum|coming soon|prossimamente|placeholder text/i, /\b(TODO|FIXME|XXX)\b/];

export async function runChecks(sandbox, { browser = true, log = () => {} } = {}) {
  const checks = [];
  const push = (id, ok, detail = "") => { checks.push({ id, ok, detail: String(detail).slice(0, 4000) }); log(`${ok ? "✓" : "✗"} ${id}${detail && !ok ? ` — ${String(detail).slice(0, 200)}` : ""}`); return ok; };
  const files = await sandbox.listFiles();
  const sizes = Object.fromEntries(files.map((f) => [f.path, f.bytes]));

  // 1. Manifest
  let manifest = null;
  try {
    const parsed = parseManifest(await sandbox.readFile(MANIFEST_PATH));
    manifest = parsed.manifest;
    push("manifest", parsed.errors.length === 0, parsed.errors.join(" "));
  } catch {
    push("manifest", false, `${MANIFEST_PATH} mancante.`);
  }

  // 2. Size and required files
  const size = checkProjectSize(sizes);
  push("size", size.errors.length === 0, size.errors.join(" ") || `${size.count} file, ${size.total} byte`);
  for (const required of ["package.json", "server.mjs", "public/index.html"]) {
    push(`file:${required}`, required in sizes, `${required} mancante.`);
  }
  let pkg = null;
  try {
    pkg = JSON.parse(await sandbox.readFile("package.json"));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    push("package", pkg.type === "module" && pkg.scripts?.start === "node server.mjs" && Object.keys(deps).length === 0,
      Object.keys(deps).length ? `Dipendenze non consentite: ${Object.keys(deps).join(", ")}` : 'package.json deve avere "type":"module" e scripts.start "node server.mjs".');
  } catch {
    push("package", false, "package.json non leggibile.");
  }
  const testFiles = files.filter((f) => /^tests\/.*\.test\.mjs$/.test(f.path));
  push("tests:present", testFiles.length > 0, "Serve almeno un file tests/*.test.mjs.");

  // 3. Syntax of every JS module + placeholder text
  const jsFiles = files.filter((f) => /\.(mjs|cjs|js)$/.test(f.path));
  const syntaxErrors = [];
  for (const f of jsFiles) {
    const r = await sandbox.exec({ cmd: `node --check ${shellPath(f.path)}`, timeoutMs: 20_000 });
    if (r.code !== 0) syntaxErrors.push(`${f.path}: ${(r.stderr || r.stdout).split("\n").slice(0, 3).join(" ")}`);
  }
  push("syntax", syntaxErrors.length === 0, syntaxErrors.join(" | "));
  const placeholders = [];
  for (const f of files.filter((x) => isTextPath(x.path) && !x.path.startsWith("tests/"))) {
    const text = await sandbox.readFile(f.path);
    for (const re of PLACEHOLDERS) {
      const m = text.match(re);
      if (m) { placeholders.push(`${f.path}: "${m[0]}"`); break; }
    }
  }
  push("no-placeholders", placeholders.length === 0, placeholders.slice(0, 5).join(" | "));

  const structural = checks.every((c) => c.ok || c.id === "no-placeholders");
  if (!structural) {
    await sandbox.stopServer();
    return finish(checks, null);
  }

  // 4. Server starts and answers /health
  const started = await sandbox.spawnServer({ cmd: "node server.mjs", healthPath: manifest.healthPath });
  if (!push("server:start", started.ok, started.ok ? started.url : `${started.error}\n${started.logs || ""}`)) {
    return finish(checks, null);
  }
  try {
    const health = await sandbox.fetch("/health");
    let body = null;
    try { body = JSON.parse(health.text); } catch { /* not json */ }
    push("server:health", health.status === 200 && body && body.ok === true, `GET /health -> ${health.status} ${health.text.slice(0, 120)}`);

    // 5. Pages
    for (const page of manifest.pages) {
      try {
        const res = await sandbox.fetch(page.path);
        const html = res.text;
        const problems = [];
        if (res.status !== 200) problems.push(`HTTP ${res.status}`);
        if (!/text\/html/i.test(res.headers["content-type"] || "")) problems.push("content-type non HTML");
        if (!/<!doctype html>/i.test(html)) problems.push("manca <!doctype html>");
        if (!/<html[^>]*\blang=/i.test(html)) problems.push("manca lang su <html>");
        if (!/<meta[^>]+name=["']viewport["']/i.test(html)) problems.push("manca meta viewport");
        if (!/<title>[^<]{2,}<\/title>/i.test(html)) problems.push("manca <title>");
        if (!/<main[\s>]|role=["']main["']/i.test(html)) problems.push("manca <main>");
        if (html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length < 200) problems.push("pagina quasi vuota (<200 caratteri di testo)");
        push(`page:${page.path}`, problems.length === 0, problems.join(", "));
      } catch (err) {
        push(`page:${page.path}`, false, err instanceof Error ? err.message : String(err));
      }
    }
    const notFound = await sandbox.fetch("/questa-pagina-non-esiste-xyz");
    push("page:404", notFound.status === 404, `Percorso inesistente -> ${notFound.status} (atteso 404)`);

    // 6. Declared API routes respond (not 404/500) — smoke only; tests do the real work
    for (const route of manifest.api || []) {
      const method = route.method.toUpperCase();
      try {
        const res = await sandbox.fetch(route.path.replace(/:[A-Za-z_]+/g, "1"), {
          method,
          headers: { "content-type": "application/json" },
          body: method === "GET" || method === "HEAD" ? undefined : "{}",
        });
        push(`api:${method} ${route.path}`, res.status !== 404 && res.status < 500, `-> ${res.status} ${res.text.slice(0, 100)}`);
      } catch (err) {
        push(`api:${method} ${route.path}`, false, err instanceof Error ? err.message : String(err));
      }
    }
  } finally {
    // Tests start their own server on a random port; free ours first.
    await sandbox.stopServer();
  }

  // 7. Project tests
  const tests = await sandbox.exec({ cmd: "node --test --test-reporter=tap --test-concurrency=1 tests/*.test.mjs", timeoutMs: 120_000, env: { DATA_DIR: ".fenix/test-data" } });
  const summary = summarizeTap(tests.stdout + tests.stderr);
  push("tests:pass", tests.code === 0 && !tests.timedOut && summary.pass > 0, tests.code === 0 ? `${summary.pass} test passati` : `exit ${tests.code}${tests.timedOut ? " (timeout)" : ""}\n${tail(tests.stdout + tests.stderr, 3000)}`);

  // 8. Browser smoke (skipped gracefully when playwright is not available)
  let browserReport = null;
  if (browser) {
    const again = await sandbox.spawnServer({ cmd: "node server.mjs", healthPath: manifest.healthPath });
    if (again.ok) {
      try {
        await sandbox.writeRuntimeFile("browser-smoke.mjs", await readFile(SMOKE_SRC, "utf8"));
        const r = await sandbox.exec({
          cmd: "node .fenix/browser-smoke.mjs",
          timeoutMs: 120_000,
          env: { BASE_URL: sandbox.internalServerUrl(), PAGES: JSON.stringify(manifest.pages.map((p) => p.path)), SHOTS_DIR: ".fenix/shots" },
        });
        try { browserReport = JSON.parse(r.stdout.trim().split("\n").pop()); } catch { browserReport = null; }
        if (!browserReport) {
          push("browser", false, `Smoke browser non ha prodotto un report: ${tail(r.stderr || r.stdout, 800)}`);
        } else if (browserReport.skipped) {
          push("browser", false, `non verificato: ${browserReport.reason}`);
        } else {
          const problems = [];
          for (const p of browserReport.pages) {
            const label = `${p.path}@${p.viewport}`;
            if (p.pageErrors.length) problems.push(`${label} errori JS: ${p.pageErrors.slice(0, 2).join("; ")}`);
            if (p.consoleErrors.length) problems.push(`${label} console: ${p.consoleErrors.slice(0, 2).join("; ")}`);
            if (p.failedRequests.length) problems.push(`${label} richieste fallite: ${p.failedRequests.slice(0, 2).join("; ")}`);
            if (p.overflowX && p.viewport === "phone") problems.push(`${label} scroll orizzontale`);
            if (p.interactive && !p.interactive.hasMain) problems.push(`${label} manca <main>`);
          }
          push("browser", problems.length === 0, problems.join(" | ") || `${browserReport.pages.length} viste OK, screenshot in .fenix/shots`);
        }
      } finally {
        await sandbox.stopServer();
      }
    } else {
      push("browser", false, `server non riavviato: ${again.error}`);
    }
  }
  return finish(checks, browserReport);
}

function finish(checks, browserReport) {
  const failed = checks.filter((c) => !c.ok);
  return { ok: failed.length === 0, checks, failed: failed.map((c) => c.id), browser: browserReport };
}

function shellPath(p) {
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

function tail(text, n) {
  return text.length > n ? `…${text.slice(-n)}` : text;
}

export function summarizeTap(out) {
  const pass = Number((out.match(/^# pass (\d+)/m) || [])[1] || 0);
  const fail = Number((out.match(/^# fail (\d+)/m) || [])[1] || 0);
  return { pass, fail };
}

/** Compact, model-facing rendering of a checks result. */
export function formatChecks(result) {
  const lines = result.checks.map((c) => `${c.ok ? "OK " : "FAIL"} ${c.id}${c.detail ? ` — ${c.detail}` : ""}`);
  return `${result.ok ? "TUTTI I CONTROLLI PASSANO." : `CONTROLLI FALLITI: ${result.failed.join(", ")}`}\n${lines.join("\n")}`;
}
