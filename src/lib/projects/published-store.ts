import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validatePublishable } from "./validate-html.ts";
import {
  isPublishedId,
  isPublishedSnapshot,
  parsePublishInput,
  PUBLISHED_STORE,
  snapshotHash,
  type PublishedSnapshot,
  type PublishInput,
} from "./published.ts";

function publishedDir() {
  return process.env.FENIX_PUBLISHED_DIR || join(process.cwd(), ".grok/published");
}

function filePath(id: string) {
  return join(publishedDir(), `${id}.json`);
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
      return mod.getStore({ name: PUBLISHED_STORE, consistency: "strong" });
    } catch {
      return mod.getStore(PUBLISHED_STORE);
    }
  } catch (err) {
    console.error("[fenix] netlify blobs unavailable", err);
    return null;
  }
}

function readFileSnapshot(id: string): PublishedSnapshot | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath(id), "utf8")) as unknown;
    return isPublishedSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeFileSnapshot(snap: PublishedSnapshot) {
  mkdirSync(publishedDir(), { recursive: true });
  const target = filePath(snap.id);
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(snap), "utf8");
  renameSync(tmp, target);
}

export async function readPublished(id: string): Promise<PublishedSnapshot | null> {
  if (!isPublishedId(id)) return null;
  const blobs = await blobsStore();
  if (blobs) {
    try {
      const value = await blobs.get(id, { type: "json" });
      return isPublishedSnapshot(value) ? value : null;
    } catch {
      return null;
    }
  }
  if (onNetlifyRuntime()) return null;
  return readFileSnapshot(id);
}

export async function writePublished(
  id: string,
  input: PublishInput,
): Promise<PublishedSnapshot | { error: string; status: number }> {
  if (!isPublishedId(id)) return { error: "Identità non valida.", status: 400 };
  const parsed = parsePublishInput(input);
  if ("error" in parsed) return { error: parsed.error, status: 400 };
  const report = validatePublishable(parsed.html, {
    kind: parsed.kind,
    projectId: id,
    palette: parsed.palette,
  });
  if (!report.ok) {
    return {
      error: report.errors[0] || "Il prodotto non è completo, non pubblico.",
      status: 422,
    };
  }
  const hash = snapshotHash(parsed.html, parsed.kind, parsed.name);
  const existing = await readPublished(id);
  if (existing && existing.hash === hash) return existing;
  const snapshot: PublishedSnapshot = {
    id,
    name: parsed.name,
    tagline: parsed.tagline,
    kind: parsed.kind,
    summary: parsed.summary,
    palette: parsed.palette,
    html: parsed.html,
    version: (existing?.version ?? 0) + 1,
    hash,
    publishedAt: Date.now(),
  };
  const blobs = await blobsStore();
  if (blobs) {
    try {
      await blobs.setJSON(id, snapshot);
    } catch (err) {
      console.error("[fenix] publish blobs set failed", err);
      return { error: "Archivio pubblicazione non disponibile.", status: 503 };
    }
  } else if (onNetlifyRuntime()) {
    return { error: "Archivio pubblicazione non disponibile.", status: 503 };
  } else {
    writeFileSnapshot(snapshot);
  }
  return snapshot;
}
