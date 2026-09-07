// Live previews of finished projects. A preview is a fresh sandbox seeded with the
// job's files, running `node server.mjs`; requests are relayed through
// `sandbox.fetch` (inside the container for Docker), so no port is ever published.
// Previews expire after PREVIEW_TTL_MS of inactivity and the pool is capped.
import { LIMITS } from "./contract.mjs";

export const PREVIEW_TTL_MS = 20 * 60_000;
export const PREVIEW_MAX = 4;
const RELAY_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);

export class PreviewPool {
  constructor({ sandboxFactory, ttlMs = PREVIEW_TTL_MS, max = PREVIEW_MAX } = {}) {
    this.sandboxFactory = sandboxFactory;
    this.ttlMs = ttlMs;
    this.max = max;
    this.live = new Map(); // jobId -> { owner, sandbox, expiresAt, timer, startedAt, files }
    this.starting = new Map(); // jobId -> Promise
  }

  get(jobId, owner) {
    const p = this.live.get(jobId);
    return p && p.owner === owner ? p : null;
  }

  touch(p) {
    p.expiresAt = Date.now() + this.ttlMs;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => { void this.stop(p.jobId); }, this.ttlMs);
    p.timer.unref?.();
  }

  /** Start (or restart) a preview for a finished job. Evicts the oldest when the pool is full. */
  async start({ jobId, owner, files, sandboxOptions = {} }) {
    if (this.starting.has(jobId)) return this.starting.get(jobId);
    const run = (async () => {
      await this.stop(jobId);
      while (this.live.size >= this.max) {
        const oldest = [...this.live.values()].sort((a, b) => a.expiresAt - b.expiresAt)[0];
        if (!oldest) break;
        await this.stop(oldest.jobId);
      }
      const sandbox = await this.sandboxFactory({ jobId: `preview-${jobId}`, ...sandboxOptions });
      try {
        for (const f of files) {
          if (typeof f?.content === "string") await sandbox.writeFile(f.path, f.content);
        }
        const started = await sandbox.spawnServer({ cmd: "node server.mjs", timeoutMs: LIMITS.serverStartSeconds * 1000 });
        if (!started.ok) {
          await sandbox.destroy().catch(() => {});
          throw Object.assign(new Error(`Anteprima non avviata: ${started.error}`), { status: 502, logs: started.logs });
        }
      } catch (err) {
        await sandbox.destroy().catch(() => {});
        throw err;
      }
      const p = { jobId, owner, sandbox, startedAt: Date.now(), expiresAt: 0, timer: null, files: files.length };
      this.live.set(jobId, p);
      this.touch(p);
      return p;
    })();
    this.starting.set(jobId, run);
    try {
      return await run;
    } finally {
      this.starting.delete(jobId);
    }
  }

  async stop(jobId) {
    const p = this.live.get(jobId);
    if (!p) return false;
    this.live.delete(jobId);
    clearTimeout(p.timer);
    await p.sandbox.destroy().catch(() => {});
    return true;
  }

  /**
   * Relay one HTTP request into the preview. Returns { status, headers, text } or null
   * when no preview is live for that job/owner.
   */
  async relay(jobId, owner, { method = "GET", path = "/", headers = {}, body } = {}) {
    const p = this.get(jobId, owner);
    if (!p) return null;
    const m = String(method).toUpperCase();
    if (!RELAY_METHODS.has(m)) throw Object.assign(new Error("Metodo non consentito."), { status: 405 });
    const safePath = path.startsWith("/") ? path : `/${path}`;
    if (safePath.startsWith("//") || safePath.includes("\\")) throw Object.assign(new Error("Percorso non valido."), { status: 400 });
    this.touch(p);
    const init = { method: m, headers: pickHeaders(headers) };
    if (body && m !== "GET" && m !== "HEAD") init.body = body;
    return p.sandbox.fetch(safePath, init);
  }

  view(jobId, owner) {
    const p = this.get(jobId, owner);
    if (!p) return { live: false };
    return { live: true, startedAt: p.startedAt, expiresAt: p.expiresAt, files: p.files };
  }

  async close() {
    for (const id of [...this.live.keys()]) await this.stop(id);
  }
}

function pickHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    const key = k.toLowerCase();
    if (key === "content-type" || key === "accept") out[key] = String(v);
  }
  return out;
}
