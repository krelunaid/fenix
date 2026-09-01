import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "../db.ts";
import {
  resolveAppAccess,
  sharedCloudSubjectHash,
  type AppAccessResolution,
} from "./app-collaboration.ts";
import { readPublished } from "./published-store.ts";
import { isPublishedId } from "./published.ts";

export const MAX_CLOUD_COLLECTION_BYTES = 256_000;
export const MAX_CLOUD_REQUEST_BYTES = MAX_CLOUD_COLLECTION_BYTES + 4_096;
export const CLOUD_COLLECTION_RE = /^[A-Za-z0-9._-]{1,80}$/;
const SESSION_RE = /^[a-f0-9]{64}$/;

type CloudRow = { rev: number; data: unknown };
export type CloudValue = { rev: number; data: unknown };
export type CloudWrite = CloudValue | { conflict: true; current: CloudValue };

export type CloudDataDeps = {
  sql?: Sql;
  siteExists?: (siteId: string) => Promise<boolean>;
  randomSession?: () => string;
  durable?: boolean;
  resolveAccess?: (sql: Sql, request: Request, siteId: string) => Promise<AppAccessResolution>;
};

function jsonClone(value: unknown): { json: string; value: unknown } | { error: string } {
  try {
    const json = JSON.stringify(value, (key, item) => {
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        throw new Error("campo riservato");
      }
      if (typeof item === "function" || typeof item === "symbol" || typeof item === "bigint") {
        throw new Error("dato non JSON");
      }
      return item;
    });
    if (json == null) return { error: "Dato JSON richiesto." };
    if (Buffer.byteLength(json, "utf8") > MAX_CLOUD_COLLECTION_BYTES) {
      return { error: "Collezione troppo grande." };
    }
    return { json, value: JSON.parse(json) as unknown };
  } catch {
    return { error: "Sono ammessi solo dati JSON sicuri." };
  }
}

export function parseCloudCollection(value: unknown): string | null {
  const col = String(value || "");
  return CLOUD_COLLECTION_RE.test(col) && !["__proto__", "prototype", "constructor"].includes(col)
    ? col
    : null;
}

export function parseCloudRevision(value: unknown): number | null {
  const rev = Number(value);
  return Number.isSafeInteger(rev) && rev >= 0 ? rev : null;
}

export function cloudSubjectHash(siteId: string, session: string): string {
  return createHash("sha256").update(`fenix-app-subject:${siteId}:${session}`).digest("hex");
}

function cookieName(siteId: string): string {
  return `fenix_app_${createHash("sha256").update(siteId).digest("hex").slice(0, 16)}`;
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const value = rest.join("=");
      return SESSION_RE.test(value) ? value : null;
    }
  }
  return null;
}

function sessionForRequest(request: Request, siteId: string, randomSession?: () => string) {
  const name = cookieName(siteId);
  const existing = readCookie(request, name);
  if (existing) return { name, value: existing, fresh: false };
  const generated = randomSession?.() ?? randomBytes(32).toString("hex");
  if (!SESSION_RE.test(generated)) throw new Error("Sessione generata non valida.");
  return { name, value: generated, fresh: true };
}

function sameOriginWrite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return false;
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "same-site" || site === "none";
}

async function readBoundedJson(
  request: Request,
): Promise<
  | { value: { op?: unknown; col?: unknown; data?: unknown; rev?: unknown } }
  | { error: "invalid" | "too-large" }
> {
  const declared = request.headers.get("content-length");
  if (declared) {
    const bytes = Number(declared);
    if (Number.isFinite(bytes) && bytes > MAX_CLOUD_REQUEST_BYTES) {
      return { error: "too-large" };
    }
  }
  if (!request.body) return { error: "invalid" };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_CLOUD_REQUEST_BYTES) {
        await reader.cancel();
        return { error: "too-large" };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "invalid" };
    }
    return {
      value: parsed as { op?: unknown; col?: unknown; data?: unknown; rev?: unknown },
    };
  } catch {
    return { error: "invalid" };
  }
}

function response(
  data: unknown,
  status = 200,
  cookie?: { name: string; value: string; path: string; maxAge?: number },
) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  if (cookie) {
    headers.append(
      "Set-Cookie",
      `${cookie.name}=${cookie.value}; Path=${cookie.path}; Max-Age=${cookie.maxAge ?? 31_536_000}; HttpOnly; Secure; SameSite=Strict`,
    );
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export async function readCloudCollection(
  sql: Sql,
  siteId: string,
  subjectHash: string,
  collection: string,
): Promise<CloudValue> {
  const rows = await sql.query<CloudRow>(
    "select rev, data from fenix_generated_app_data where site_id=$1 and subject_hash=$2 and collection=$3",
    [siteId, subjectHash, collection],
  );
  const row = rows[0];
  return row ? { rev: Number(row.rev), data: row.data } : { rev: 0, data: null };
}

export async function writeCloudCollection(
  sql: Sql,
  siteId: string,
  subjectHash: string,
  collection: string,
  expectedRev: number,
  value: unknown,
): Promise<CloudWrite | { error: string }> {
  const cloned = jsonClone(value);
  if ("error" in cloned) return cloned;
  if (expectedRev === 0) {
    const inserted = await sql.query<CloudRow>(
      "insert into fenix_generated_app_data (site_id, subject_hash, collection, rev, data) values ($1,$2,$3,1,$4::jsonb) on conflict do nothing returning rev, data",
      [siteId, subjectHash, collection, cloned.json],
    );
    if (inserted[0]) return { rev: Number(inserted[0].rev), data: inserted[0].data };
  } else {
    const updated = await sql.query<CloudRow>(
      "update fenix_generated_app_data set data=$5::jsonb, rev=rev+1, updated_at=now() where site_id=$1 and subject_hash=$2 and collection=$3 and rev=$4 returning rev, data",
      [siteId, subjectHash, collection, expectedRev, cloned.json],
    );
    if (updated[0]) return { rev: Number(updated[0].rev), data: updated[0].data };
  }
  return {
    conflict: true,
    current: await readCloudCollection(sql, siteId, subjectHash, collection),
  };
}

function productionNeedsDurableSql(): boolean {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

export async function handleCloudDataRequest(
  request: Request,
  siteId: string,
  deps: CloudDataDeps = {},
): Promise<Response> {
  if (request.method !== "POST") return response({ error: "Metodo non consentito." }, 405);
  if (!isPublishedId(siteId)) return response({ error: "Sito non valido." }, 400);
  if (!sameOriginWrite(request)) return response({ error: "Origine non consentita." }, 403);
  const durable =
    deps.durable ?? (!productionNeedsDurableSql() || Boolean(process.env.DATABASE_URL?.trim()));
  if (!durable) {
    return response({ error: "Dati cloud non configurati.", shared: false }, 503);
  }
  const exists = deps.siteExists
    ? await deps.siteExists(siteId)
    : Boolean(await readPublished(siteId));
  if (!exists) return response({ error: "Sito non trovato." }, 404);
  const parsed = await readBoundedJson(request);
  if ("error" in parsed) {
    return parsed.error === "too-large"
      ? response({ error: "Richiesta troppo grande." }, 413)
      : response({ error: "JSON non valido." }, 400);
  }
  const body = parsed.value;
  const collection = parseCloudCollection(body.col);
  if (!collection) return response({ error: "Collezione non valida." }, 400);
  const sql = deps.sql ?? (await (await import("../db.ts")).getSql());
  const access = await (deps.resolveAccess ?? resolveAppAccess)(sql, request, siteId);
  if (access.state === "invalid") {
    return response({ error: "Invito scaduto o revocato.", shared: false }, 401, {
      name: access.cookieName,
      value: "",
      path: `/api/app-data/${siteId}`,
      maxAge: 0,
    });
  }
  const shared = access.state === "active";
  const role = shared ? access.role : undefined;
  const session = shared ? null : sessionForRequest(request, siteId, deps.randomSession);
  const subjectHash = shared
    ? sharedCloudSubjectHash(siteId)
    : cloudSubjectHash(siteId, session!.value);
  const cookie = session?.fresh
    ? { name: session.name, value: session.value, path: `/api/app-data/${siteId}` }
    : undefined;
  const meta = shared
    ? { mode: "cloud-shared", shared: true, role }
    : { mode: "cloud-private", shared: false };
  if (body.op === "load") {
    const current = await readCloudCollection(sql, siteId, subjectHash, collection);
    return response({ ok: true, ...meta, ...current }, 200, cookie);
  }
  if (body.op !== "save") return response({ error: "Operazione non valida." }, 400, cookie);
  if (shared && role !== "editor") {
    return response({ error: "Invito in sola lettura.", ...meta }, 403);
  }
  const rev = parseCloudRevision(body.rev);
  if (rev == null) return response({ error: "Revisione non valida." }, 400, cookie);
  const saved = await writeCloudCollection(sql, siteId, subjectHash, collection, rev, body.data);
  if ("error" in saved) return response({ error: saved.error }, 400, cookie);
  if ("conflict" in saved) {
    return response(
      { error: "Conflitto dati.", conflict: true, ...meta, current: saved.current },
      409,
      cookie,
    );
  }
  return response({ ok: true, ...meta, ...saved }, 200, cookie);
}
