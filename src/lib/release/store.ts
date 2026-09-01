import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { LEASE_MS, PLATFORMS, RELEASE_STORE, type Platform, type PublicReleaseJob, type StoredReleaseJob } from "./types.ts";
import { REVIEW_NOTE } from "./types.ts";
import { redactSecrets } from "./redact.ts";

export type ReleaseSql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type ReleaseStore = {
  claimReleaseKey: (key: string, id: string) => Promise<{ won: boolean; id: string }>;
  readReleaseJob: (id: string) => Promise<StoredReleaseJob | null>;
  readReleaseByKey: (key: string) => Promise<StoredReleaseJob | null>;
  writeReleaseJob: (job: StoredReleaseJob) => Promise<StoredReleaseJob>;
  acquireReleaseLease: (id: string, token: string, now?: number) => Promise<StoredReleaseJob | null>;
};

function releaseDir() {
  return process.env.FENIX_RELEASE_DIR || join(process.cwd(), ".grok/release");
}

function filePath(id: string) {
  return join(releaseDir(), `${id}.json`);
}

function keyPath(key: string) {
  const safe = key.replace(/[^a-f0-9]/gi, "").slice(0, 64) || "none";
  return join(releaseDir(), `key-${safe}.json`);
}

function onNetlifyRuntime() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

export function releaseInstanceId(): string {
  return process.env.FENIX_INSTANCE || `${process.pid}-${randomUUID().slice(0, 8)}`;
}

type BlobStore = {
  get: (key: string, opts?: { type: "json" }) => Promise<unknown>;
  setJSON: (key: string, value: unknown) => Promise<void>;
};

let testBlobs: BlobStore | null = null;
let testSql: ReleaseSql | null = null;

export function setReleaseBlobsForTest(store: BlobStore | null) {
  testBlobs = store;
}

export function setReleaseSqlForTest(sql: ReleaseSql | null) {
  testSql = sql;
}

export function resetReleaseClaimsForTest() {
  testBlobs = null;
  testSql = null;
}

async function liveSql(): Promise<ReleaseSql | null> {
  if (testSql) return testSql;
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    const { getSql } = await import("../db.ts");
    return await getSql();
  } catch {
    return null;
  }
}

async function blobsStore(): Promise<BlobStore | null> {
  if (testBlobs) return testBlobs;
  return null;
}

function isJob(value: unknown): value is StoredReleaseJob {
  if (!value || typeof value !== "object") return false;
  const rec = value as StoredReleaseJob;
  return typeof rec.id === "string" && typeof rec.idempotencyKey === "string" && Array.isArray(rec.log);
}

function readFileJob(id: string): StoredReleaseJob | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath(id), "utf8")) as unknown;
    return isJob(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeFileJob(job: StoredReleaseJob) {
  mkdirSync(releaseDir(), { recursive: true });
  const target = filePath(job.id);
  const tmp = `${target}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  writeFileSync(tmp, JSON.stringify(job), "utf8");
  renameSync(tmp, target);
}

function readFileKey(key: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(keyPath(key), "utf8")) as { id?: string };
    return typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

function claimFileKey(key: string, id: string): { won: boolean; id: string } {
  mkdirSync(releaseDir(), { recursive: true });
  try {
    writeFileSync(keyPath(key), JSON.stringify({ id, claimedAt: Date.now() }), {
      encoding: "utf8",
      flag: "wx",
    });
    return { won: true, id };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "EEXIST") throw err;
    const existing = readFileKey(key);
    return { won: existing === id, id: existing || id };
  }
}

function scrubTracks(job: StoredReleaseJob): StoredReleaseJob["tracks"] {
  const tracks = { ...job.tracks };
  for (const key of Object.keys(tracks) as Platform[]) {
    const t = tracks[key];
    if (!t) continue;
    tracks[key] = {
      ...t,
      error: t.error ? redactSecrets(t.error) : undefined,
      artifact: t.artifact ? redactSecrets(t.artifact) : undefined,
    };
  }
  return tracks;
}

export function publicReleaseJob(job: StoredReleaseJob): PublicReleaseJob {
  return {
    id: job.id,
    projectId: job.projectId,
    platforms: job.platforms,
    status: job.status,
    step: job.step,
    log: job.log.map(redactSecrets),
    tracks: scrubTracks(job),
    config: job.config,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error ? redactSecrets(job.error) : undefined,
    name: job.name,
    reviewNote: REVIEW_NOTE,
  };
}

function mergeProvider(
  prev: StoredReleaseJob | null,
  next: StoredReleaseJob,
): StoredReleaseJob {
  if (!prev) return next;
  const tracks = { ...next.tracks };
  for (const p of PLATFORMS) {
    const a = prev.tracks[p];
    const b = tracks[p] || a;
    if (!a && !b) continue;
    const provider = { ...(a?.provider || {}), ...(b?.provider || {}) };
    for (const key of Object.keys(a?.provider || {})) {
      const k = key as keyof NonNullable<typeof provider>;
      if (provider[k] == null && a?.provider?.[k] != null) {
        (provider as Record<string, unknown>)[k] = a.provider[k];
      }
    }
    tracks[p] = {
      ...(a || b)!,
      ...b,
      provider,
      uploads: Math.max(a?.uploads || 0, b?.uploads || 0),
    };
  }
  return {
    ...prev,
    ...next,
    tracks,
    version: next.version ?? prev.version,
  };
}

function rowJob(row: { job?: unknown; version?: unknown }): StoredReleaseJob | null {
  const job = isJob(row.job) ? row.job : typeof row.job === "string" ? (JSON.parse(row.job) as unknown) : row.job;
  if (!isJob(job)) return null;
  if (typeof row.version === "number") job.version = row.version;
  return job;
}

async function sqlClaim(sql: ReleaseSql, key: string, id: string): Promise<{ won: boolean; id: string }> {
  const inserted = await sql.query<{ id: string }>(
    `INSERT INTO release_jobs (id, idempotency_key, owner_hash, job, version)
     VALUES ($1, $2, '', '{}'::jsonb, 1)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [id, key],
  );
  if (inserted[0]?.id) return { won: true, id: inserted[0].id };
  const existing = await sql.query<{ id: string }>(
    `SELECT id FROM release_jobs WHERE idempotency_key = $1 LIMIT 1`,
    [key],
  );
  const got = existing[0]?.id || id;
  return { won: got === id, id: got };
}

async function sqlRead(sql: ReleaseSql, id: string): Promise<StoredReleaseJob | null> {
  const rows = await sql.query<{ job: unknown; version: number }>(
    `SELECT job, version FROM release_jobs WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  return rowJob(rows[0]);
}

async function sqlReadByKey(sql: ReleaseSql, key: string): Promise<StoredReleaseJob | null> {
  const rows = await sql.query<{ job: unknown; version: number }>(
    `SELECT job, version FROM release_jobs WHERE idempotency_key = $1 LIMIT 1`,
    [key],
  );
  if (!rows[0]) return null;
  return rowJob(rows[0]);
}

async function sqlWrite(sql: ReleaseSql, job: StoredReleaseJob): Promise<StoredReleaseJob> {
  const prev = await sqlRead(sql, job.id);
  const merged = mergeProvider(prev, job);
  const expected = prev?.version ?? merged.version ?? 1;
  const payload = JSON.stringify(merged);
  const updated = await sql.query<{ version: number }>(
    `UPDATE release_jobs
     SET job = $1::jsonb,
         version = version + 1,
         owner_hash = $2,
         lease_owner = $3,
         lease_until = CASE WHEN $4::bigint IS NULL THEN NULL ELSE to_timestamp($4::bigint / 1000.0) END,
         updated_at = now()
     WHERE id = $5 AND version = $6
     RETURNING version`,
    [
      payload,
      merged.ownerHash,
      merged.leaseOwner || null,
      merged.leaseUntil ?? null,
      merged.id,
      expected,
    ],
  );
  if (updated[0]?.version) {
    merged.version = Number(updated[0].version);
    return merged;
  }
  const inserted = await sql.query<{ version: number }>(
    `INSERT INTO release_jobs (id, idempotency_key, owner_hash, job, version, lease_owner, lease_until)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, CASE WHEN $7::bigint IS NULL THEN NULL ELSE to_timestamp($7::bigint / 1000.0) END)
     ON CONFLICT (id) DO NOTHING
     RETURNING version`,
    [
      merged.id,
      merged.idempotencyKey,
      merged.ownerHash,
      payload,
      expected,
      merged.leaseOwner || null,
      merged.leaseUntil ?? null,
    ],
  );
  if (inserted[0]?.version) {
    merged.version = Number(inserted[0].version);
    return merged;
  }
  const live = await sqlRead(sql, job.id);
  if (!live) throw new Error("Scrittura release in conflitto.");
  const retry = mergeProvider(live, merged);
  retry.version = live.version;
  const again = await sql.query<{ version: number }>(
    `UPDATE release_jobs
     SET job = $1::jsonb, version = version + 1, owner_hash = $2, updated_at = now()
     WHERE id = $3 AND version = $4
     RETURNING version`,
    [JSON.stringify(retry), retry.ownerHash, retry.id, live.version],
  );
  if (!again[0]) throw new Error("Scrittura release in conflitto (version).");
  retry.version = Number(again[0].version);
  return retry;
}

async function sqlLease(
  sql: ReleaseSql,
  id: string,
  token: string,
  now = Date.now(),
): Promise<StoredReleaseJob | null> {
  const until = now + LEASE_MS;
  const rows = await sql.query<{ job: unknown; version: number }>(
    `UPDATE release_jobs
     SET lease_owner = $2,
         lease_until = to_timestamp($3::bigint / 1000.0),
         version = version + 1,
         updated_at = now()
     WHERE id = $1
       AND (lease_until IS NULL OR lease_until <= to_timestamp($4::bigint / 1000.0) OR lease_owner = $2)
     RETURNING job, version`,
    [id, token, until, now],
  );
  if (!rows[0]) return null;
  const job = rowJob(rows[0]);
  if (!job) return null;
  job.leaseOwner = token;
  job.leaseUntil = until;
  return job;
}

export function createReleaseStore(opts: { sql: ReleaseSql; instanceId?: string }): ReleaseStore {
  const sql = opts.sql;
  return {
    claimReleaseKey: (key, id) => sqlClaim(sql, key, id),
    readReleaseJob: (id) => sqlRead(sql, id),
    readReleaseByKey: (key) => sqlReadByKey(sql, key),
    writeReleaseJob: (job) => sqlWrite(sql, job),
    acquireReleaseLease: (id, token, now) => sqlLease(sql, id, token, now),
  };
}

export async function createReleaseSqlForTest(): Promise<{ sql: ReleaseSql; close: () => Promise<void> }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  const ddlPath = join(dirname(fileURLToPath(import.meta.url)), "../../../migrations/0002_release_jobs.sql");
  const ddl = readFileSync(ddlPath, "utf8");
  await pg.exec(ddl);
  const sql: ReleaseSql = {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query<T>(text, params);
      return res.rows as T[];
    },
  };
  return {
    sql,
    close: async () => {
      await pg.close();
    },
  };
}

export async function readReleaseJob(id: string): Promise<StoredReleaseJob | null> {
  if (!id || id.length < 8) return null;
  const sql = await liveSql();
  if (sql) return sqlRead(sql, id);
  const blobs = await blobsStore();
  if (blobs) {
    try {
      const value = await blobs.get(id, { type: "json" });
      return isJob(value) ? value : null;
    } catch {
      return null;
    }
  }
  if (onNetlifyRuntime()) return null;
  return readFileJob(id);
}

export async function readReleaseByKey(key: string): Promise<StoredReleaseJob | null> {
  const sql = await liveSql();
  if (sql) return sqlReadByKey(sql, key);
  const blobs = await blobsStore();
  if (blobs) {
    try {
      const idx = (await blobs.get(`key-${key}`, { type: "json" })) as { id?: string } | null;
      if (idx?.id) return readReleaseJob(idx.id);
      return null;
    } catch {
      return null;
    }
  }
  if (onNetlifyRuntime()) return null;
  const id = readFileKey(key);
  return id ? readFileJob(id) : null;
}

export async function claimReleaseKey(
  key: string,
  id: string,
): Promise<{ won: boolean; id: string }> {
  const sql = await liveSql();
  if (sql) return sqlClaim(sql, key, id);
  const blobs = await blobsStore();
  if (blobs) {
    // Intentionally racy: Netlify Blobs is not CAS. Production uses Postgres.
    const slot = `key-${key}`;
    const existing = (await blobs.get(slot, { type: "json" }).catch(() => null)) as { id?: string } | null;
    if (existing?.id && existing.id !== id) return { won: false, id: existing.id };
    if (existing?.id === id) return { won: true, id };
    await blobs.setJSON(slot, { id, claimedAt: Date.now() });
    const confirm = (await blobs.get(slot, { type: "json" })) as { id?: string } | null;
    return { won: confirm?.id === id, id: confirm?.id || id };
  }
  if (onNetlifyRuntime()) throw new Error("Archivio release non disponibile.");
  return claimFileKey(key, id);
}

export async function waitReleaseByKey(key: string, tries = 25): Promise<StoredReleaseJob | null> {
  for (let i = 0; i < tries; i++) {
    const job = await readReleaseByKey(key);
    if (job && job.html) return job;
    await new Promise((r) => setTimeout(r, 20));
  }
  return readReleaseByKey(key);
}

export function canTakeLease(job: StoredReleaseJob, token?: string, now = Date.now()): boolean {
  if (!job.leaseUntil || job.leaseUntil <= now) return true;
  if (!token) return false;
  return job.leaseOwner === token;
}

export function withLease(
  job: StoredReleaseJob,
  token: string,
  now = Date.now(),
): StoredReleaseJob {
  return {
    ...job,
    leaseOwner: token,
    leaseUntil: now + LEASE_MS,
  };
}

export async function acquireReleaseLease(
  id: string,
  token: string,
  now = Date.now(),
): Promise<StoredReleaseJob | null> {
  const sql = await liveSql();
  if (sql) return sqlLease(sql, id, token, now);
  const job = await readReleaseJob(id);
  if (!job) return null;
  if (!canTakeLease(job, token, now)) return null;
  return writeReleaseJob(withLease(job, token, now));
}

export async function writeReleaseJob(job: StoredReleaseJob): Promise<StoredReleaseJob> {
  const next: StoredReleaseJob = {
    ...job,
    tracks: scrubTracks(job),
    log: job.log.map(redactSecrets),
    error: job.error ? redactSecrets(job.error) : undefined,
    updatedAt: Date.now(),
  };
  const sql = await liveSql();
  if (sql) return sqlWrite(sql, next);
  const blobs = await blobsStore();
  if (blobs) {
    await blobs.setJSON(next.id, next);
    await blobs.setJSON(`key-${next.idempotencyKey}`, { id: next.id });
    return next;
  }
  if (onNetlifyRuntime()) {
    throw new Error("Archivio release non disponibile.");
  }
  writeFileJob(next);
  return next;
}

void RELEASE_STORE;
