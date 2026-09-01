import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RELEASE_STORE, type Platform, type PublicReleaseJob, type StoredReleaseJob } from "./types.ts";
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

type BlobStore = {
  get: (key: string, opts?: { type: "json" }) => Promise<unknown>;
  setJSON: (key: string, value: unknown) => Promise<void>;
};

async function blobsStore(): Promise<BlobStore | null> {
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
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(job), "utf8");
  renameSync(tmp, target);
  const k = keyPath(job.idempotencyKey);
  writeFileSync(`${k}.${process.pid}.tmp`, JSON.stringify({ id: job.id }), "utf8");
  renameSync(`${k}.${process.pid}.tmp`, k);
}

function readFileKey(key: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(keyPath(key), "utf8")) as { id?: string };
    return typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
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
