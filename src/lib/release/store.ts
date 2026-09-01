import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { LEASE_MS, RELEASE_STORE, type Platform, type PublicReleaseJob, type StoredReleaseJob } from "./types.ts";
import { REVIEW_NOTE } from "./types.ts";
import { redactSecrets } from "./redact.ts";

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

export function setReleaseBlobsForTest(store: BlobStore | null) {
  testBlobs = store;
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
      return mod.getStore({ name: RELEASE_STORE, consistency: "strong" });
    } catch {
      return mod.getStore(RELEASE_STORE);
    }
  } catch {
    return null;
  }
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

export async function readReleaseJob(id: string): Promise<StoredReleaseJob | null> {
  if (!id || id.length < 8) return null;
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

const claimsInflight = new Map<string, Promise<{ won: boolean; id: string }>>();

export function resetReleaseClaimsForTest() {
  claimsInflight.clear();
  testBlobs = null;
}

async function claimBlobs(
  blobs: BlobStore,
  key: string,
  id: string,
): Promise<{ won: boolean; id: string }> {
  const slot = `key-${key}`;
  const token = randomUUID();
  const existing = (await blobs.get(slot, { type: "json" }).catch(() => null)) as
    | { id?: string }
    | null;
  if (existing?.id && existing.id !== id) return { won: false, id: existing.id };
  if (existing?.id === id) return { won: true, id };
  await blobs.setJSON(slot, { id, token, claimedAt: Date.now() });
  const confirm = (await blobs.get(slot, { type: "json" })) as
    | { id?: string; token?: string }
    | null;
  if (confirm?.id && confirm.id !== id) return { won: false, id: confirm.id };
  if (confirm?.token && confirm.token !== token) {
    return { won: confirm.id === id, id: confirm.id || id };
  }
  return { won: true, id };
}

export async function claimReleaseKey(
  key: string,
  id: string,
): Promise<{ won: boolean; id: string }> {
  const pending = claimsInflight.get(key);
  if (pending) {
    const result = await pending;
    return { won: result.id === id, id: result.id };
  }
  const work = (async () => {
    const blobs = await blobsStore();
    if (blobs) return claimBlobs(blobs, key, id);
    if (onNetlifyRuntime()) throw new Error("Archivio release non disponibile.");
    return claimFileKey(key, id);
  })();
  claimsInflight.set(key, work);
  return work;
}

export async function waitReleaseByKey(key: string, tries = 25): Promise<StoredReleaseJob | null> {
  for (let i = 0; i < tries; i++) {
    const job = await readReleaseByKey(key);
    if (job) return job;
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

export async function writeReleaseJob(job: StoredReleaseJob): Promise<StoredReleaseJob> {
  const next: StoredReleaseJob = {
    ...job,
    tracks: scrubTracks(job),
    log: job.log.map(redactSecrets),
    error: job.error ? redactSecrets(job.error) : undefined,
    updatedAt: Date.now(),
  };
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
