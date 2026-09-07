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
import { fileURLToPath } from "node:url";
import { JobStore } from "./jobs.mjs";
import { runAgent } from "./agent.mjs";
import { createSandbox } from "./sandbox/index.mjs";
import { AnthropicModel } from "./model/anthropic.mjs";
import { PROJECT_KINDS, canonicalizePath, LIMITS } from "./contract.mjs";

const MAX_BODY = 6 * 1024 * 1024;

export function createAgentServer({
  token = process.env.AGENT_TOKEN,
  origin = process.env.FENIX_ORIGIN || "",
  modelFactory = () => new AnthropicModel(),
  sandboxFactory = (opts) => createSandbox(opts),
  store = new JobStore({ concurrency: Number(process.env.AGENT_CONCURRENCY || 2) }),
  browserChecks = process.env.AGENT_BROWSER_CHECKS !== "0",
  limits = {},
} = {}) {
  if (!token || token.length < 16) throw new Error("AGENT_TOKEN mancante o troppo corto (min 16 caratteri).");
  const tokenBuf = Buffer.from(token);

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

        const job = store.create({
          owner,
          input: { brief: brief.slice(0, 4000), kind, name: body.name ? String(body.name).slice(0, 80) : undefined, instruction },
          run: async ({ job, onEvent, signal }) => {
            const sandbox = await sandboxFactory({ jobId: job.id });
            try {
              for (const f of files) await sandbox.writeFile(f.path, f.content);
              return await runAgent({
                model: modelFactory(),
                sandbox,
                brief: brief.slice(0, 4000),
                kind,
                name: body.name,
                extras: body.extras && typeof body.extras === "object" ? body.extras : undefined,
                instruction: instruction || undefined,
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

      const m = url.pathname.match(/^\/agent\/jobs\/([A-Za-z0-9-]{8,64})$/);
      if (m) {
        const job = store.get(m[1], owner);
        if (!job) { json(res, 404, { error: "Job non trovato." }); return; }
        if (req.method === "GET") { json(res, 200, store.publicView(job, { full: url.searchParams.get("full") === "1" })); return; }
        if (req.method === "DELETE") { store.cancel(job.id, owner); json(res, 200, { id: job.id, status: job.status }); return; }
      }
      json(res, 404, { error: "Rotta sconosciuta." });
    } catch (err) {
      const status = err?.status || 500;
      json(res, status, { error: status === 500 ? "Errore interno." : err.message });
      if (status === 500) console.error("[fenix-agent]", err);
    }
  });
  server.store = store;
  return server;
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
  const server = createAgentServer();
  server.listen(port, "127.0.0.1", () => console.log(`[fenix-agent] in ascolto locale su :${port} (sandbox=docker)`));
}
