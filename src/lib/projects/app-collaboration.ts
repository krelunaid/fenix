import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Sql } from "../db.ts";
import { ownerFromRequest } from "./publish-owner.ts";
import { hashOwner, readPublished } from "./published-store.ts";
import { isPublishedId } from "./published.ts";

export type AppRole = "viewer" | "editor";
export type PublicAppInvite = {
  id: string;
  role: AppRole;
  label: string;
  createdAt: number;
  expiresAt: number;
};

type InviteRow = {
  id: string;
  role: AppRole;
  label: string;
  created_ms: number;
  expires_ms: number;
};

export type AppAccessResolution =
  | { state: "none" }
  | { state: "invalid"; cookieName: string }
  | { state: "active"; role: AppRole; inviteId: string; cookieName: string };

export type AppCollaborationDeps = {
  sql?: Sql;
  durable?: boolean;
  now?: () => number;
  token?: () => string;
  id?: () => string;
  readSite?: typeof readPublished;
};

const TOKEN_RE = /^[a-f0-9]{64}$/;
const INVITE_ID_RE = /^[A-Za-z0-9-]{8,80}$/;
const MAX_BODY_BYTES = 8_192;
const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

function productionNeedsDurableSql(): boolean {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

function safeLabel(value: unknown): string | null {
  const label = String(value || "")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return label || null;
}

function parseRole(value: unknown): AppRole | null {
  return value === "viewer" || value === "editor" ? value : null;
}

function inviteHash(siteId: string, token: string): string {
  return createHash("sha256").update(`fenix-app-access:${siteId}:${token}`).digest("hex");
}

export function sharedCloudSubjectHash(siteId: string): string {
  return createHash("sha256").update(`fenix-app-shared:${siteId}`).digest("hex");
}

export function appAccessCookieName(siteId: string): string {
  return `fenix_share_${createHash("sha256").update(siteId).digest("hex").slice(0, 16)}`;
}

function readCookie(
  request: Request,
  name: string,
): { present: false } | { present: true; token: string | null } {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== name) continue;
    const value = rest.join("=").toLowerCase();
    return { present: true, token: TOKEN_RE.test(value) ? value : null };
  }
  return { present: false };
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return false;
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "same-site" || site === "none";
}

async function readBoundedBody(request: Request): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function json(
  value: unknown,
  status = 200,
  cookie?: { siteId: string; token?: string; clear?: boolean },
): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  if (cookie) {
    const name = appAccessCookieName(cookie.siteId);
    const maxAge = cookie.clear ? 0 : Math.floor(INVITE_TTL_MS / 1_000);
    headers.append(
      "Set-Cookie",
      `${name}=${cookie.clear ? "" : cookie.token}; Path=/api/app-data/${cookie.siteId}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`,
    );
  }
  return new Response(JSON.stringify(value), { status, headers });
}

function publicInvite(row: InviteRow): PublicAppInvite {
  return {
    id: row.id,
    role: row.role,
    label: row.label,
    createdAt: Number(row.created_ms),
    expiresAt: Number(row.expires_ms),
  };
}

export async function createAppInvite(
  sql: Sql,
  siteId: string,
  role: AppRole,
  label: string,
  options: { now: number; token: string; id: string },
): Promise<{ invite: PublicAppInvite; token: string }> {
  if (!TOKEN_RE.test(options.token) || !INVITE_ID_RE.test(options.id)) {
    throw new Error("Invito generato non valido.");
  }
  const expiresAt = options.now + INVITE_TTL_MS;
  const rows = await sql.query<InviteRow>(
    "insert into fenix_app_access (id, site_id, token_hash, role, label, created_at, expires_at) values ($1,$2,$3,$4,$5,to_timestamp($6 / 1000.0),to_timestamp($7 / 1000.0)) returning id, role, label, (extract(epoch from created_at)*1000)::bigint as created_ms, (extract(epoch from expires_at)*1000)::bigint as expires_ms",
    [options.id, siteId, inviteHash(siteId, options.token), role, label, options.now, expiresAt],
  );
  if (!rows[0]) throw new Error("Invito non salvato.");
  return { invite: publicInvite(rows[0]), token: options.token };
}

export async function listAppInvites(
  sql: Sql,
  siteId: string,
  now = Date.now(),
): Promise<PublicAppInvite[]> {
  const rows = await sql.query<InviteRow>(
    "select id, role, label, (extract(epoch from created_at)*1000)::bigint as created_ms, (extract(epoch from expires_at)*1000)::bigint as expires_ms from fenix_app_access where site_id=$1 and revoked_at is null and expires_at > to_timestamp($2 / 1000.0) order by created_at desc limit 24",
    [siteId, now],
  );
  return rows.map(publicInvite);
}

export async function revokeAppInvite(sql: Sql, siteId: string, id: string): Promise<boolean> {
  if (!INVITE_ID_RE.test(id)) return false;
  const rows = await sql.query<{ id: string }>(
    "update fenix_app_access set revoked_at=now() where site_id=$1 and id=$2 and revoked_at is null returning id",
    [siteId, id],
  );
  return Boolean(rows[0]);
}

export async function resolveAppAccess(
  sql: Sql,
  request: Request,
  siteId: string,
  now = Date.now(),
): Promise<AppAccessResolution> {
  const cookieName = appAccessCookieName(siteId);
  const cookie = readCookie(request, cookieName);
  if (!cookie.present) return { state: "none" };
  if (!cookie.token) return { state: "invalid", cookieName };
  const rows = await sql.query<{ id: string; role: AppRole }>(
    "select id, role from fenix_app_access where site_id=$1 and token_hash=$2 and revoked_at is null and expires_at > to_timestamp($3 / 1000.0) limit 1",
    [siteId, inviteHash(siteId, cookie.token), now],
  );
  const row = rows[0];
  return row
    ? { state: "active", role: row.role, inviteId: row.id, cookieName }
    : { state: "invalid", cookieName };
}

async function ownerOwnsSite(request: Request, siteId: string, deps: AppCollaborationDeps) {
  const owner = ownerFromRequest(request);
  if (!owner) return { error: "Identità assente.", status: 401 } as const;
  const snap = await (deps.readSite ?? readPublished)(siteId);
  if (!snap) return { error: "Sito non trovato.", status: 404 } as const;
  if (!snap.ownerHash || snap.ownerHash !== hashOwner(owner)) {
    return { error: "Non sei il titolare di questo sito.", status: 403 } as const;
  }
  return null;
}

export async function handleAppCollaborationRequest(
  request: Request,
  siteId: string,
  deps: AppCollaborationDeps = {},
): Promise<Response> {
  if (!isPublishedId(siteId)) return json({ error: "Sito non valido." }, 400);
  const durable =
    deps.durable ?? (!productionNeedsDurableSql() || Boolean(process.env.DATABASE_URL?.trim()));
  if (!durable) return json({ error: "Collaborazione non configurata." }, 503);
  const sql = deps.sql ?? (await (await import("../db.ts")).getSql());
  const now = deps.now?.() ?? Date.now();

  if (request.method === "GET") {
    const denied = await ownerOwnsSite(request, siteId, deps);
    if (denied) return json({ error: denied.error }, denied.status);
    return json({ invites: await listAppInvites(sql, siteId, now) });
  }
  if (request.method !== "POST") return json({ error: "Metodo non consentito." }, 405);
  if (!sameOrigin(request)) return json({ error: "Origine non consentita." }, 403);
  const body = await readBoundedBody(request);
  if (!body) return json({ error: "JSON non valido o troppo grande." }, 400);

  if (body.op === "exchange") {
    const token = String(body.token || "").toLowerCase();
    if (!TOKEN_RE.test(token)) return json({ error: "Invito non valido." }, 400);
    const probe = new Request(request.url, {
      headers: { cookie: `${appAccessCookieName(siteId)}=${token}` },
    });
    const access = await resolveAppAccess(sql, probe, siteId, now);
    if (access.state !== "active") {
      return json({ error: "Invito scaduto o revocato." }, 401, { siteId, clear: true });
    }
    return json({ ok: true, role: access.role, shared: true, expiresIn: INVITE_TTL_MS }, 200, {
      siteId,
      token,
    });
  }

  const denied = await ownerOwnsSite(request, siteId, deps);
  if (denied) return json({ error: denied.error }, denied.status);
  if (body.op === "create") {
    const role = parseRole(body.role);
    const label = safeLabel(body.label);
    if (!role || !label) return json({ error: "Ruolo o etichetta non validi." }, 400);
    const token = deps.token?.() ?? randomBytes(32).toString("hex");
    const id = deps.id?.() ?? randomUUID();
    const created = await createAppInvite(sql, siteId, role, label, { now, token, id });
    return json(created, 201);
  }
  if (body.op === "revoke") {
    const id = String(body.id || "");
    const revoked = await revokeAppInvite(sql, siteId, id);
    return revoked ? json({ ok: true }) : json({ error: "Invito non trovato." }, 404);
  }
  return json({ error: "Operazione non valida." }, 400);
}
