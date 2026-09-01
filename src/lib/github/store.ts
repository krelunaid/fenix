import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GITHUB_STORE, type StoredExportJob, type StoredInstallation } from "./types.ts";

function githubDir() {
  return process.env.FENIX_GITHUB_DIR || join(process.cwd(), ".grok/github");
}

function hashOwner(ownerId: string): string {
  return createHash("sha256").update(`fenix-github-owner:${ownerId}`).digest("hex");
}

export function githubOwnerHash(ownerId: string): string {
  return hashOwner(ownerId);
}

export type GitHubSql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

type Memory = {
  installations: Map<string, StoredInstallation>;
  nonces: Map<string, number>;
  jobs: Map<string, StoredExportJob>;
  keys: Map<string, string>;
};

const memory: Memory = {
  installations: new Map(),
  nonces: new Map(),
  jobs: new Map(),
  keys: new Map(),
};

let useMemory = false;
let testSql: GitHubSql | null = null;

export function setGitHubStoreMemoryForTest(on = true) {
  useMemory = on;
  if (on) {
    memory.installations.clear();
    memory.nonces.clear();
    memory.jobs.clear();
    memory.keys.clear();
  }
}

export function setGitHubSqlForTest(sql: GitHubSql | null) {
  testSql = sql;
}

type BlobStore = {
  get: (key: string, opts?: { type: "json" }) => Promise<unknown>;
  setJSON: (key: string, value: unknown) => Promise<void>;
  delete?: (key: string) => Promise<void>;
};

let testBlobs: BlobStore | null = null;

export function setGitHubBlobsForTest(store: BlobStore | null) {
  testBlobs = store;
}

function onNetlifyRuntime() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

async function liveSql(): Promise<GitHubSql | null> {
  if (testSql) return testSql;
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    const { getSql } = await import("../db.ts");
    return await getSql();
  } catch {
    return null;
  }
}

/** UNIQUE nonce store is ready: test memory/SQL, or DATABASE_URL with github_connect_nonces. Never Blobs. */
export async function githubNonceStoreReady(): Promise<boolean> {
  if (useMemory) return true;
  const sql = await liveSql();
  if (!sql) return false;
  try {
    await sql.query("SELECT 1 FROM github_connect_nonces WHERE false");
    return true;
  } catch {
    return false;
  }
}

async function blobsStore(): Promise<BlobStore | null> {
  if (testBlobs) return testBlobs;
  if (!onNetlifyRuntime() && !process.env.NETLIFY_SITE_ID) return null;
  try {
    const mod = (await import("@netlify/blobs")) as {
      getStore?: (name: string | { name: string; consistency?: string }) => BlobStore;
    };
    if (typeof mod.getStore !== "function") return null;
    try {
      return mod.getStore({ name: GITHUB_STORE, consistency: "strong" });
    } catch {
      return mod.getStore(GITHUB_STORE);
    }
  } catch {
    return null;
  }
}

function atomicWrite(path: string, json: unknown) {
  mkdirSync(githubDir(), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(json), "utf8");
  renameSync(tmp, path);
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function installPath(ownerHash: string) {
  return join(githubDir(), `inst-${ownerHash.slice(0, 32)}.json`);
}

function noncePath(nonce: string) {
  return join(githubDir(), `nonce-${nonce}.json`);
}

function jobPath(id: string) {
  return join(githubDir(), `job-${id}.json`);
}

function keyPath(key: string) {
  return join(githubDir(), `key-${key.slice(0, 40)}.json`);
}

function blobKey(kind: "inst" | "job" | "key", id: string): string {
  return `${kind}-${id}`.slice(0, 80);
}

function idempotencyKey(ownerHash: string, repo: string, branch: string, contentHash: string): string {
  return createHash("sha256").update(`${ownerHash}:${repo}:${branch}:${contentHash}`).digest("hex");
}

function isInstallation(value: unknown): value is StoredInstallation {
  if (!value || typeof value !== "object") return false;
  const row = value as StoredInstallation;
  return Boolean(row.ownerHash && row.installationId);
}

function isJob(value: unknown): value is StoredExportJob {
  if (!value || typeof value !== "object") return false;
  const job = value as StoredExportJob;
  return Boolean(job.id && job.ownerHash && job.repo && Array.isArray(job.log));
}

export async function saveInstallation(row: StoredInstallation): Promise<void> {
  if (useMemory) {
    memory.installations.set(row.ownerHash, row);
    return;
  }
  const blobs = await blobsStore();
  if (blobs) {
    await blobs.setJSON(blobKey("inst", row.ownerHash.slice(0, 32)), row);
    return;
  }
  if (onNetlifyRuntime()) throw new Error("Archivio GitHub non disponibile.");
  atomicWrite(installPath(row.ownerHash), row);
}

export async function readInstallation(ownerHash: string): Promise<StoredInstallation | null> {
  if (useMemory) return memory.installations.get(ownerHash) || null;
  const blobs = await blobsStore();
  if (blobs) {
    try {
      const value = await blobs.get(blobKey("inst", ownerHash.slice(0, 32)), { type: "json" });
      if (!isInstallation(value) || value.ownerHash !== ownerHash) return null;
      return value;
    } catch {
      return null;
    }
  }
  if (onNetlifyRuntime()) return null;
  const row = readJson<StoredInstallation>(installPath(ownerHash));
  if (!isInstallation(row) || row.ownerHash !== ownerHash) return null;
  return row;
}

export async function deleteInstallation(ownerHash: string): Promise<void> {
  if (useMemory) {
    memory.installations.delete(ownerHash);
    return;
  }
  const blobs = await blobsStore();
  if (blobs) {
    const key = blobKey("inst", ownerHash.slice(0, 32));
    if (blobs.delete) await blobs.delete(key);
    else await blobs.setJSON(key, { ownerHash, installationId: "", connectedAt: 0 });
    return;
  }
  if (onNetlifyRuntime()) return;
  try {
    unlinkSync(installPath(ownerHash));
  } catch {
    /* missing */
  }
}

/** Atomic single-use nonce. UNIQUE insert in SQL; never Blobs. */
export async function consumeNonce(nonce: string, ownerHash: string, exp: number): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(nonce) || !ownerHash) return false;
  if (useMemory) {
    if (memory.nonces.has(nonce)) return false;
    memory.nonces.set(nonce, exp);
    return true;
  }
  const sql = await liveSql();
  if (sql) {
    try {
      const rows = await sql.query<{ nonce: string }>(
        `INSERT INTO github_connect_nonces (nonce, owner_hash, exp)
         VALUES ($1, $2, $3)
         ON CONFLICT (nonce) DO NOTHING
         RETURNING nonce`,
        [nonce, ownerHash, exp],
      );
      return Boolean(rows[0]?.nonce);
    } catch {
      return false;
    }
  }
  if (onNetlifyRuntime()) return false;
  const path = noncePath(nonce);
  try {
    mkdirSync(githubDir(), { recursive: true });
    writeFileSync(path, JSON.stringify({ nonce, ownerHash, exp }), { encoding: "utf8", flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

export async function createGitHubSqlForTest(): Promise<{ sql: GitHubSql; close: () => Promise<void> }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  const ddlPath = join(dirname(fileURLToPath(import.meta.url)), "../../../migrations/0003_github_connect_nonces.sql");
  await pg.exec(readFileSync(ddlPath, "utf8"));
  const sql: GitHubSql = {
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

export async function saveExportJob(job: StoredExportJob): Promise<StoredExportJob> {
  const next = { ...job, updatedAt: Date.now() };
  const key = idempotencyKey(next.ownerHash, next.repo, next.branch, next.contentHash);
  if (useMemory) {
    memory.jobs.set(next.id, next);
    memory.keys.set(`${next.ownerHash}:${next.repo}:${next.branch}:${next.contentHash}`, next.id);
    return next;
  }
  const blobs = await blobsStore();
  if (blobs) {
    await blobs.setJSON(blobKey("job", next.id), next);
    await blobs.setJSON(blobKey("key", key.slice(0, 40)), { id: next.id });
    return next;
  }
  if (onNetlifyRuntime()) throw new Error("Archivio GitHub non disponibile.");
  atomicWrite(jobPath(next.id), next);
  atomicWrite(keyPath(key), { id: next.id });
  return next;
}

export async function readExportJob(id: string): Promise<StoredExportJob | null> {
  if (useMemory) return memory.jobs.get(id) || null;
  const blobs = await blobsStore();
  if (blobs) {
    try {
      const value = await blobs.get(blobKey("job", id), { type: "json" });
      return isJob(value) && value.id === id ? value : null;
    } catch {
      return null;
    }
  }
  if (onNetlifyRuntime()) return null;
  const job = readJson<StoredExportJob>(jobPath(id));
  return isJob(job) && job.id === id ? job : null;
}

export async function findExportJob(
  ownerHash: string,
  repo: string,
  branch: string,
  contentHash: string,
): Promise<StoredExportJob | null> {
  if (useMemory) {
    const id = memory.keys.get(`${ownerHash}:${repo}:${branch}:${contentHash}`);
    return id ? memory.jobs.get(id) || null : null;
  }
  const key = idempotencyKey(ownerHash, repo, branch, contentHash);
  const blobs = await blobsStore();
  if (blobs) {
    try {
      const ref = (await blobs.get(blobKey("key", key.slice(0, 40)), { type: "json" })) as { id?: string } | null;
      if (!ref?.id) return null;
      const job = await readExportJob(ref.id);
      if (!job || job.ownerHash !== ownerHash || job.repo !== repo || job.branch !== branch) return null;
      if (job.contentHash !== contentHash) return null;
      return job;
    } catch {
      return null;
    }
  }
  if (onNetlifyRuntime()) return null;
  const ref = readJson<{ id?: string }>(keyPath(key));
  if (!ref?.id) return null;
  const job = await readExportJob(ref.id);
  if (!job || job.ownerHash !== ownerHash || job.repo !== repo || job.branch !== branch) return null;
  if (job.contentHash !== contentHash) return null;
  return job;
}

export function newExportId(): string {
  return randomUUID();
}

export function publicJob(job: StoredExportJob): {
  id: string;
  status: StoredExportJob["status"];
  repo: string;
  branch: string;
  contentHash: string;
  commitSha?: string;
  unchanged?: boolean;
  htmlUrl?: string;
  files: StoredExportJob["files"];
  log: string[];
  error?: string;
} {
  return {
    id: job.id,
    status: job.status,
    repo: job.repo,
    branch: job.branch,
    contentHash: job.contentHash,
    commitSha: job.commitSha,
    unchanged: job.unchanged,
    htmlUrl: job.htmlUrl,
    files: job.files,
    log: job.log,
    error: job.error,
  };
}
