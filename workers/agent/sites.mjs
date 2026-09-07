// Published apps: durable records on the agent host + on-demand hosting.
//
// A published app is the file tree of a finished job under a public slug. Its
// SQLite data lives in a per-slug directory on the host (the only bind mount the
// sandbox ever gets). The app process is started on first request and stopped after
// an idle period; data survives because it is outside the container.
//
// Layout under AGENT_DATA_DIR/sites:
//   <slug>.json          { slug, owner, name, kind, files, version, publishedAt, updatedAt, jobId }
//   <slug>/data/app.db   the app's database (created by the app itself)
import { mkdir, readFile, writeFile, readdir, rm, rename } from "node:fs/promises";
import { join } from "node:path";
import { LIMITS } from "./contract.mjs";
import { PreviewPool } from "./preview.mjs";

export const SITE_IDLE_MS = 10 * 60_000;
export const SITE_POOL_MAX = 8;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
const RESERVED = new Set(["api", "app", "agent", "admin", "studio", "login", "static", "assets", "www", "fenix"]);

export function slugify(input) {
  const base = String(input || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base.length >= 3 ? base : `app-${Math.random().toString(36).slice(2, 8)}`;
}

export function validSlug(slug) {
  return SLUG_RE.test(slug) && !RESERVED.has(slug);
}

export class SiteStore {
  constructor({ dir }) {
    this.dir = dir;
  }

  file(slug) { return join(this.dir, `${slug}.json`); }
  dataDir(slug) { return join(this.dir, slug, "data"); }

  async read(slug) {
    try {
      const raw = JSON.parse(await readFile(this.file(slug), "utf8"));
      return raw && raw.slug === slug ? raw : null;
    } catch {
      return null;
    }
  }

  async write(record) {
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.file(record.slug)}.tmp`;
    await writeFile(tmp, JSON.stringify(record), "utf8");
    await rename(tmp, this.file(record.slug));
  }

  async remove(slug) {
    await rm(this.file(slug), { force: true });
    await rm(join(this.dir, slug), { recursive: true, force: true });
  }

  async listByOwner(owner) {
    let names = [];
    try { names = await readdir(this.dir); } catch { return []; }
    const out = [];
    for (const n of names) {
      if (!n.endsWith(".json")) continue;
      const rec = await this.read(n.slice(0, -5));
      if (rec && rec.owner === owner) out.push(publicRecord(rec));
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Publish (or update) a site from a job's files. A slug already taken by
   * another owner is refused; the same owner updates in place (version+1).
   */
  async publish({ slug, owner, name, kind, files, jobId }) {
    if (!validSlug(slug)) throw Object.assign(new Error("Indirizzo non valido: 3-40 caratteri, lettere minuscole, numeri e trattini."), { status: 400 });
    const text = files.filter((f) => typeof f?.content === "string" && typeof f?.path === "string");
    if (text.length === 0) throw Object.assign(new Error("Nessun file da pubblicare."), { status: 400 });
    const bytes = text.reduce((n, f) => n + Buffer.byteLength(f.content), 0);
    if (bytes > LIMITS.maxProjectBytes) throw Object.assign(new Error("Progetto troppo grande."), { status: 413 });
    const existing = await this.read(slug);
    if (existing && existing.owner !== owner) throw Object.assign(new Error("Indirizzo già usato da un altro utente."), { status: 409 });
    const now = Date.now();
    const record = {
      slug,
      owner,
      name: String(name || slug).slice(0, 80),
      kind: kind === "site" ? "site" : "app",
      files: text.map((f) => ({ path: f.path, content: f.content })),
      version: existing ? existing.version + 1 : 1,
      publishedAt: existing ? existing.publishedAt : now,
      updatedAt: now,
      jobId: jobId || null,
    };
    await this.write(record);
    return publicRecord(record);
  }
}

export function publicRecord(rec) {
  return { slug: rec.slug, name: rec.name, kind: rec.kind, version: rec.version, publishedAt: rec.publishedAt, updatedAt: rec.updatedAt, files: rec.files.length, jobId: rec.jobId };
}

/**
 * Hosting: a PreviewPool keyed by slug, with the persistent data dir mounted and a
 * cold start on demand. Requests for a published app go through `serve`.
 */
export class SitePool {
  constructor({ store, sandboxFactory, idleMs = SITE_IDLE_MS, max = SITE_POOL_MAX }) {
    this.store = store;
    this.pool = new PreviewPool({ sandboxFactory, ttlMs: idleMs, max });
  }

  /** Make sure the app for `slug` is running (cold start) and current (version match). */
  async ensure(slug) {
    const rec = await this.store.read(slug);
    if (!rec) return null;
    const live = this.pool.live.get(slug);
    if (live && live.version === rec.version) return live;
    if (live) await this.pool.stop(slug);
    const p = await this.pool.start({ jobId: slug, owner: rec.owner, files: rec.files, sandboxOptions: { dataDir: this.store.dataDir(slug) } });
    p.version = rec.version;
    return p;
  }

  /** Relay a public request into the app, starting it if needed. */
  async serve(slug, { method, path, headers, body }) {
    const p = await this.ensure(slug);
    if (!p) return null;
    return this.pool.relay(slug, p.owner, { method, path, headers, body });
  }

  async stop(slug) { return this.pool.stop(slug); }
  async close() { return this.pool.close(); }
  view(slug) { const p = this.pool.live.get(slug); return p ? { live: true, startedAt: p.startedAt, expiresAt: p.expiresAt, version: p.version } : { live: false }; }
}
