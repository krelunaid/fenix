// Fenix agent worker — HTTP front for the agent loop.
//
//   AGENT_TOKEN=…  ANTHROPIC_API_KEY=…  AGENT_SANDBOX=docker  node workers/agent/server.mjs
//
// Every route except GET /health requires `Authorization: Bearer $AGENT_TOKEN`.
// Jobs are bound to the caller id (header `x-fenix-owner`, or "anonymous").
//
//   POST   /agent/build   { brief, kind?, name?, extras?, files?, instruction? } -> 202 { id }
//   GET    /agent/jobs/:id[?full=1]                                              -> job view
//   DELETE /agent/jobs/:id                                                       -> cancel
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { snapshot as snapshotBackup, list as listBackups } from "./backup.mjs";
import { fileURLToPath } from "node:url";
import { JobStore } from "./jobs.mjs";
import { PreviewPool } from "./preview.mjs";
import { SiteStore, SitePool, slugify } from "./sites.mjs";
import { join } from "node:path";
import { runAgent } from "./agent.mjs";
import { createSandbox } from "./sandbox/index.mjs";
import { byokFromHeaders, createModel } from "./model/index.mjs";
import { PROJECT_KINDS, canonicalizePath, LIMITS } from "./contract.mjs";

const MAX_BODY = 6 * 1024 * 1024;

const CONTEXT_HISTORY_MAX = 10;
const CONTEXT_ITEM_MAX = 300;

/**
 * Memory an edit job carries: the original brief, the summary of the last run and
 * the list of previous instructions. Derived from the parent job when known (its own
 * context chains further back), otherwise from what the caller sent.
 */
export function projectContext({ parent = null, sent = null } = {}) {
  const clip = (v, n = CONTEXT_ITEM_MAX) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const sentCtx = sent && typeof sent === "object" ? sent : {};
  const chain = parent?.input?.context || {};
  const brief = clip(chain.brief || parent?.input?.brief || sentCtx.brief, 1200);
  const history = [];
  const push = (h) => { const instruction = clip(h?.instruction); if (!instruction) return; history.push({ instruction, summary: clip(h?.summary) }); };
  if (parent) {
    for (const h of chain.history || []) push(h);
    if (parent.input?.instruction) push({ instruction: parent.input.instruction, summary: parent.result?.summary });
  } else if (Array.isArray(sentCtx.history)) {
    for (const h of sentCtx.history) push(h);
  }
  const lastSummary = clip(parent ? parent.result?.summary : sentCtx.summary, 800);
  const out = { brief, history: history.slice(-CONTEXT_HISTORY_MAX), lastSummary };
  return out.brief || out.history.length || out.lastSummary ? out : null;
}

export function createAgentServer({
  token = process.env.AGENT_TOKEN,
  origin = process.env.FENIX_ORIGIN || "",
  modelFactory = (byok) => createModel(byok || {}),
  sandboxFactory = (opts) => createSandbox(opts),
  dataDir = process.env.AGENT_DATA_DIR || null,
  store = new JobStore({ concurrency: Number(process.env.AGENT_CONCURRENCY || 2), dataDir }),
  previews = null,
  sites = null,
  browserChecks = process.env.AGENT_BROWSER_CHECKS !== "0",
  backupDir = process.env.AGENT_BACKUP_DIR || null,
  limits = {},
} = {}) {
  if (!token || token.length < 16) throw new Error("AGENT_TOKEN mancante o troppo corto (min 16 caratteri).");
  const tokenBuf = Buffer.from(token);
  const pool = previews || new PreviewPool({ sandboxFactory });
  const siteStore = sites?.store || (dataDir ? new SiteStore({ dir: join(dataDir, "sites") }) : null);
  const sitePool = sites || (siteStore ? new SitePool({ store: siteStore, sandboxFactory }) : null);

  const cors = (res) => {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-fenix-owner");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    }
  };
  const json = (res, status, body) => {
    cors(res);
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  };
  const authorized = (req) => {
    const h = String(req.headers.authorization || "");
    if (!h.startsWith("Bearer ")) return false;
    const given = Buffer.from(h.slice(7).trim());
    return given.length === tokenBuf.length && timingSafeEqual(given, tokenBuf);
  };
  const ownerOf = (req) => {
    const raw = String(req.headers["x-fenix-owner"] || "").trim();
    return /^[a-f0-9]{32,64}$/.test(raw) ? raw : null;
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://local");
    if (req.method === "OPTIONS") { cors(res); res.writeHead(204); res.end(); return; }
    if (req.method === "GET" && url.pathname === "/health") { json(res, 200, { ok: true, service: "fenix-agent" }); return; }
    if (!authorized(req)) { json(res, 401, { error: "Token mancante o non valido." }); return; }
    // Operator routes: token only, no owner (run by cron/systemd, never by the Studio).
    if (url.pathname === "/agent/admin/backups") {
      if (!dataDir || !backupDir) { json(res, 503, { error: "Backup non configurato: servono AGENT_DATA_DIR e AGENT_BACKUP_DIR." }); return; }
      try {
        if (req.method === "GET") { json(res, 200, { backups: await listBackups({ outDir: backupDir }) }); return; }
        if (req.method === "POST") {
          const m = await snapshotBackup({ dataDir, outDir: backupDir, keep: Number(process.env.AGENT_BACKUP_KEEP || 14) });
          json(res, 200, { stamp: m.stamp, dir: m.dir, sites: m.sites, jobs: m.jobs, files: m.files, bytes: m.bytes, pruned: m.pruned });
          return;
        }
      } catch (err) {
        json(res, 500, { error: err?.message || "Backup fallito." });
        return;
      }
      json(res, 405, { error: "Metodo non consentito." }); return;
    }
    const owner = ownerOf(req);
    if (!owner) { json(res, 400, { error: "Identità verificata del chiamante obbligatoria." }); return; }

    try {
      if (req.method === "POST" && url.pathname === "/agent/build") {
        const body = await readJson(req);
        const brief = String(body.brief || "").trim();
        const instruction = body.instruction ? String(body.instruction).trim().slice(0, 4000) : "";
        if (brief.length < 3 && !instruction) { json(res, 400, { error: "Scrivi cosa vuoi costruire." }); return; }
        const kind = PROJECT_KINDS.has(body.kind) ? body.kind : "app";
        const files = Array.isArray(body.files) ? body.files : [];
        if (files.length > LIMITS.maxFiles) { json(res, 413, { error: "Troppi file." }); return; }
        for (const f of files) {
          if (!f || typeof f.path !== "string" || typeof f.content !== "string") { json(res, 400, { error: "files deve contenere { path, content }." }); return; }
          try { canonicalizePath(f.path); } catch (err) { json(res, 400, { error: err.message }); return; }
        }
        if (instruction && files.length === 0) { json(res, 400, { error: "Una modifica richiede i file del progetto." }); return; }
        // Project memory for edits: chain from the parent job when it lives on this host,
        // else from what the Studio sends (brief + prior instructions).
        const parentJobId = typeof body.parentJobId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.parentJobId) ? body.parentJobId : null;
        const parent = instruction && parentJobId ? await store.find(parentJobId, owner) : null;
        const context = instruction ? projectContext({ parent, sent: body.context }) : null;
        // Optional per-request BYOK (provider/key/model). Kept in memory for this job only.
        let byok = null;
        try { byok = byokFromHeaders(req.headers); } catch (err) { json(res, err.status || 400, { error: err.message }); return; }
        let model;
        try { model = modelFactory(byok); } catch (err) { json(res, err.status || 503, { error: err.message }); return; }

        const job = store.create({
          owner,
          input: { brief: brief.slice(0, 4000), kind, name: body.name ? String(body.name).slice(0, 80) : undefined, instruction, parentJobId: parent ? parent.id : parentJobId, context: context || undefined, provider: byok?.provider || process.env.AGENT_PROVIDER || "anthropic", model: model.model },
          run: async ({ job, onEvent, signal }) => {
            const sandbox = await sandboxFactory({ jobId: job.id });
            try {
              for (const f of files) await sandbox.writeFile(f.path, f.content);
              return await runAgent({
                model,
                sandbox,
                brief: brief.slice(0, 4000),
                kind,
                name: body.name,
                extras: body.extras && typeof body.extras === "object" ? body.extras : undefined,
                instruction: instruction || undefined,
                context: context || undefined,
                onEvent,
                signal,
                browserChecks,
                limits,
              });
            } finally {
              await sandbox.destroy().catch(() => {});
            }
          },
        });
        json(res, 202, { id: job.id, status: job.status, position: job.position });
        return;
      }

      // Live preview of a finished job: /agent/jobs/:id/preview[/relayed/path]
      const pv = url.pathname.match(/^\/agent\/jobs\/([A-Za-z0-9-]{8,64})\/preview(\/.*)?$/);
      if (pv) {
        const job = await store.find(pv[1], owner);
        if (!job) { json(res, 404, { error: "Job non trovato." }); return; }
        const relayPath = pv[2];
        if (relayPath == null) {
          if (req.method === "GET") { json(res, 200, pool.view(job.id, owner)); return; }
          if (req.method === "DELETE") { json(res, 200, { live: false, stopped: await pool.stop(job.id) }); return; }
          if (req.method === "POST") {
            const files = job.result?.files?.filter((f) => typeof f.content === "string") || [];
            if (job.status !== "ok" || files.length === 0) { json(res, 409, { error: "Anteprima disponibile solo per un lavoro concluso con successo." }); return; }
            try {
              await pool.start({ jobId: job.id, owner, files });
            } catch (err) {
              json(res, err?.status || 502, { error: err?.message || "Anteprima non avviata.", logs: err?.logs });
              return;
            }
            json(res, 200, pool.view(job.id, owner));
            return;
          }
          json(res, 405, { error: "Metodo non consentito." }); return;
        }
        const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readText(req);
        const relayed = await pool.relay(job.id, owner, {
          method: req.method,
          path: `${relayPath}${url.search}`,
          headers: { "content-type": req.headers["content-type"], accept: req.headers.accept },
          body,
        });
        if (!relayed) { json(res, 409, { error: "Anteprima non attiva: avviala con POST …/preview." }); return; }
        cors(res);
        res.writeHead(relayed.status, {
          "content-type": relayed.headers["content-type"] || "application/octet-stream",
          "cache-control": "no-store",
          "x-fenix-preview": job.id,
        });
        res.end(relayed.text);
        return;
      }

      const m = url.pathname.match(/^\/agent\/jobs\/([A-Za-z0-9-]{8,64})$/);
      if (m) {
        const job = await store.find(m[1], owner);
        if (!job) { json(res, 404, { error: "Job non trovato." }); return; }
        if (req.method === "GET") { json(res, 200, store.publicView(job, { full: url.searchParams.get("full") === "1" })); return; }
        if (req.method === "DELETE") { store.cancel(job.id, owner); await pool.stop(job.id); json(res, 200, { id: job.id, status: job.status }); return; }
      }
      // Published apps (durable, hosted on demand).
      if (url.pathname === "/agent/sites") {
        if (!sitePool) { json(res, 503, { error: "Pubblicazione non configurata: manca AGENT_DATA_DIR." }); return; }
        if (req.method === "GET") { json(res, 200, { sites: await siteStore.listByOwner(owner) }); return; }
        if (req.method === "POST") {
          const body = await readJson(req);
          const job = await store.find(String(body.jobId || ""), owner);
          if (!job || job.status !== "ok" || !job.result?.files?.length) { json(res, 409, { error: "Pubblica solo un lavoro concluso con successo." }); return; }
          const slug = body.slug ? String(body.slug).toLowerCase() : slugify(body.name || job.input?.name || job.input?.brief || job.id);
          try {
            const rec = await siteStore.publish({ slug, owner, name: body.name || job.input?.name || job.input?.brief?.slice(0, 60), kind: job.input?.kind, files: job.result.files, jobId: job.id });
            await sitePool.stop(slug); // a new version replaces the running one on next request
            json(res, 200, rec);
          } catch (err) {
            json(res, err?.status || 500, { error: err?.message || "Pubblicazione fallita." });
          }
          return;
        }
        json(res, 405, { error: "Metodo non consentito." }); return;
      }
      const st = url.pathname.match(/^\/agent\/sites\/([a-z0-9-]{3,40})(\/.*)?$/);
      if (st) {
        if (!sitePool) { json(res, 503, { error: "Pubblicazione non configurata: manca AGENT_DATA_DIR." }); return; }
        const slug = st[1];
        const relayPath = st[2];
        if (relayPath == null) {
          const rec = await siteStore.read(slug);
          if (!rec || rec.owner !== owner) { json(res, 404, { error: "Sito non trovato." }); return; }
          if (req.method === "GET") { json(res, 200, { ...(await siteStore.listByOwner(owner)).find((r) => r.slug === slug), hosting: sitePool.view(slug) }); return; }
          if (req.method === "DELETE") { await sitePool.stop(slug); await siteStore.remove(slug); json(res, 200, { slug, removed: true }); return; }
          json(res, 405, { error: "Metodo non consentito." }); return;
        }
        // Public traffic: the Fenix proxy calls this for anyone; the owner header is the
        // proxy's own identity and is intentionally not checked against the site owner.
        const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readText(req);
        let relayed;
        try {
          relayed = await sitePool.serve(slug, { method: req.method, path: `${relayPath}${url.search}`, headers: { "content-type": req.headers["content-type"], accept: req.headers.accept }, body });
        } catch (err) {
          json(res, err?.status || 502, { error: err?.message || "App non avviata." }); return;
        }
        if (!relayed) { json(res, 404, { error: "Sito non trovato." }); return; }
        cors(res);
        res.writeHead(relayed.status, { "content-type": relayed.headers["content-type"] || "application/octet-stream", "cache-control": "no-store", "x-fenix-site": slug });
        res.end(relayed.text);
        return;
      }
      json(res, 404, { error: "Rotta sconosciuta." });
    } catch (err) {
      const status = err?.status || 500;
      json(res, status, { error: status === 500 ? "Errore interno." : err.message });
      if (status === 500) console.error("[fenix-agent]", err);
    }
  });
  server.store = store;
  server.previews = pool;
  server.sites = sitePool;
  return server;
}

async function readText(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) throw Object.assign(new Error("Richiesta troppo grande."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(req) {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_BODY) throw Object.assign(new Error("Richiesta troppo grande."), { status: 413 });
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) throw Object.assign(new Error("Richiesta troppo grande."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw Object.assign(new Error("JSON non valido."), { status: 400 });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.AGENT_SANDBOX !== "docker") throw new Error("HTTP agent requires Docker isolation; local is for fixture tests only.");
  const port = Number(process.env.PORT || 8790);
  // Loopback by default (a TLS reverse proxy publishes it). HOST=0.0.0.0 only inside a
  // container whose network is already private (see workers/agent/Dockerfile).
  const host = process.env.HOST === "0.0.0.0" ? "0.0.0.0" : "127.0.0.1";
  const server = createAgentServer();
  server.listen(port, host, () => console.log(`[fenix-agent] in ascolto su ${host}:${port} (sandbox=docker, data=${process.env.AGENT_DATA_DIR || "solo memoria"})`));
}
