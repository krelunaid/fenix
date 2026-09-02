import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Sql } from "../db.ts";
import {
  ingestProjectFiles,
  inspectFile,
  canonicalizePath,
  fileLooksLikeSecret,
  type ProjectFile,
} from "./files.ts";
import { ifMatchSatisfied, ownerFromRequest, parseIfMatch } from "./publish-owner.ts";
import {
  auditDocDetail,
  decideDocOp,
  emptySharedDoc,
  parseDocOps,
  serializeDocOps,
  type SharedDoc,
} from "./workspace-doc.ts";

export type WorkspaceRole = "owner" | "viewer" | "editor";
export type MemberRole = "viewer" | "editor";

export const WORKSPACE_ID_RE = /^w[a-f0-9]{16,32}$/;
export const PROJECT_ID_RE = /^[A-Za-z0-9._-]{8,80}$/;
export const MEMBER_ID_RE = /^[A-Za-z0-9-]{8,80}$/;
export const SESSION_ID_RE = /^s[a-f0-9]{16,32}$/;
export const TOKEN_RE = /^[a-f0-9]{64}$/;
export const PRESENCE_TTL_MS = 45_000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const MAX_AUDIT = 64;
export const WORKSPACE_NOT_CONFIGURED =
  "Collaborazione sul progetto non configurata. Serve un database durevole (DATABASE_URL con le migrazioni 0006–0007) e un’identità titolare. I ruoli vivono solo sul server.";

const MAX_BODY_BYTES = 1_600_000;
const MAX_NAME = 80;

export type WorkspaceDeps = {
  sql?: Sql;
  durable?: boolean;
  now?: () => number;
  token?: () => string;
  id?: () => string;
};

type WorkspaceRow = {
  id: string;
  owner_hash: string;
  project_id: string;
  name: string;
  tree_json: string;
  cas_version: number;
  cas_hash: string;
};

type MemberRow = {
  id: string;
  user_hash: string;
  role: MemberRole;
  label: string;
};

type InviteRow = {
  id: string;
  role: MemberRole;
  label: string;
  created_ms: number;
  expires_ms: number;
};

export type PublicMember = {
  id: string;
  role: WorkspaceRole;
  label: string;
  you?: boolean;
};

export type PublicInvite = {
  id: string;
  role: MemberRole;
  label: string;
  createdAt: number;
  expiresAt: number;
};

export type PublicPresence = {
  memberId: string;
  role: WorkspaceRole;
  sessions: number;
  lastSeen: number;
};

export type PublicAudit = {
  id: string;
  at: number;
  actor: string;
  kind: string;
  detail: string;
};

function productionNeedsDurableSql(): boolean {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

export function workspaceUserHash(ownerId: string): string {
  return createHash("sha256").update(`fenix-workspace-user:${ownerId}`).digest("hex");
}

function inviteHash(workspaceId: string, token: string): string {
  return createHash("sha256").update(`fenix-workspace-invite:${workspaceId}:${token}`).digest("hex");
}

function actorPrefix(userHash: string): string {
  return userHash.slice(0, 8);
}

export function treeHash(files: ProjectFile[]): string {
  const canonical = [...files]
    .map((f) => ({ path: f.path, content: f.content }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function parseTree(raw: string): ProjectFile[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return ingestProjectFiles(
      parsed.filter(
        (row): row is ProjectFile =>
          Boolean(row) &&
          typeof row === "object" &&
          typeof (row as ProjectFile).path === "string" &&
          typeof (row as ProjectFile).content === "string",
      ),
    ).files;
  } catch {
    return [];
  }
}

function safeName(value: unknown): string | null {
  const name = String(value || "")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
  return name || null;
}

function safeLabel(value: unknown): string | null {
  const label = String(value || "")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return label || null;
}

function parseMemberRole(value: unknown): MemberRole | null {
  return value === "viewer" || value === "editor" ? value : null;
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

function json(value: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(value), { status, headers });
}

async function resolveSql(deps: WorkspaceDeps): Promise<
  { ok: true; sql: Sql } | { ok: false; response: Response }
> {
  const durable =
    deps.durable ?? (!productionNeedsDurableSql() || Boolean(process.env.DATABASE_URL?.trim()));
  if (!durable) return { ok: false, response: json({ error: WORKSPACE_NOT_CONFIGURED }, 503) };
  try {
    const sql = deps.sql ?? (await (await import("../db.ts")).getSql());
    return { ok: true, sql };
  } catch {
    return { ok: false, response: json({ error: WORKSPACE_NOT_CONFIGURED }, 503) };
  }
}

async function audit(
  sql: Sql,
  workspaceId: string,
  actor: string,
  kind: string,
  detail: string,
  now: number,
  id: string,
) {
  await sql.query(
    "insert into fenix_workspace_audit (id, workspace_id, at, actor, kind, detail) values ($1,$2,to_timestamp($3 / 1000.0),$4,$5,$6)",
    [id, workspaceId, now, actor.slice(0, 8), kind.slice(0, 32), detail.slice(0, 180)],
  );
  await sql.query(
    "delete from fenix_workspace_audit where workspace_id=$1 and id not in (select id from fenix_workspace_audit where workspace_id=$1 order by at desc limit $2)",
    [workspaceId, MAX_AUDIT],
  );
}

async function readWorkspace(sql: Sql, id: string): Promise<WorkspaceRow | null> {
  if (!WORKSPACE_ID_RE.test(id)) return null;
  const rows = await sql.query<WorkspaceRow>(
    "select id, owner_hash, project_id, name, tree_json, cas_version::int as cas_version, cas_hash from fenix_workspaces where id=$1 limit 1",
    [id],
  );
  return rows[0] ?? null;
}

type DocRow = {
  content: string;
  version: number;
  ops_json: string;
};

async function ensureDoc(sql: Sql, workspaceId: string, now: number): Promise<SharedDoc> {
  await sql.query(
    "insert into fenix_workspace_docs (workspace_id, content, version, ops_json, updated_at) values ($1,'',0,'[]',to_timestamp($2 / 1000.0)) on conflict (workspace_id) do nothing",
    [workspaceId, now],
  );
  const rows = await sql.query<DocRow>(
    "select content, version::int as version, ops_json from fenix_workspace_docs where workspace_id=$1 limit 1",
    [workspaceId],
  );
  const row = rows[0];
  if (!row) return emptySharedDoc();
  return {
    content: typeof row.content === "string" ? row.content : "",
    version: Number(row.version) || 0,
    ops: parseDocOps(row.ops_json),
  };
}

function publicDoc(doc: SharedDoc) {
  return { content: doc.content, version: doc.version };
}

const docTails = new Map<string, Promise<unknown>>();

function enqueueDoc<T>(workspaceId: string, work: () => Promise<T>): Promise<T> {
  const prev = docTails.get(workspaceId) ?? Promise.resolve();
  const next = prev.then(work, work);
  docTails.set(
    workspaceId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

type Access =
  | { state: "none" }
  | { state: "anon" }
  | { state: "forbidden" }
  | {
      state: "ok";
      role: WorkspaceRole;
      userHash: string;
      memberId: string;
      label: string;
      workspace: WorkspaceRow;
    };

async function resolveAccess(
  sql: Sql,
  request: Request,
  workspaceId: string,
): Promise<Access> {
  const owner = ownerFromRequest(request);
  if (!owner) return { state: "anon" };
  const workspace = await readWorkspace(sql, workspaceId);
  if (!workspace) return { state: "none" };
  const userHash = workspaceUserHash(owner);
  if (workspace.owner_hash === userHash) {
    return {
      state: "ok",
      role: "owner",
      userHash,
      memberId: "owner",
      label: "Titolare",
      workspace,
    };
  }
  const rows = await sql.query<MemberRow>(
    "select id, user_hash, role, label from fenix_workspace_members where workspace_id=$1 and user_hash=$2 and revoked_at is null limit 1",
    [workspaceId, userHash],
  );
  const row = rows[0];
  if (!row) return { state: "forbidden" };
  return {
    state: "ok",
    role: row.role,
    userHash,
    memberId: row.id,
    label: row.label,
    workspace,
  };
}

function canWrite(role: WorkspaceRole): boolean {
  return role === "owner" || role === "editor";
}

async function listMembers(sql: Sql, workspace: WorkspaceRow, you: string): Promise<PublicMember[]> {
  const rows = await sql.query<MemberRow>(
    "select id, user_hash, role, label from fenix_workspace_members where workspace_id=$1 and revoked_at is null order by joined_at asc",
    [workspace.id],
  );
  const out: PublicMember[] = [
    {
      id: "owner",
      role: "owner",
      label: "Titolare",
      you: workspace.owner_hash === you,
    },
  ];
  for (const row of rows) {
    out.push({
      id: row.id,
      role: row.role,
      label: row.label,
      you: row.user_hash === you,
    });
  }
  return out;
}

async function listInvites(sql: Sql, workspaceId: string, now: number): Promise<PublicInvite[]> {
  const rows = await sql.query<InviteRow>(
    "select id, role, label, (extract(epoch from created_at)*1000)::bigint as created_ms, (extract(epoch from expires_at)*1000)::bigint as expires_ms from fenix_workspace_invites where workspace_id=$1 and revoked_at is null and consumed_at is null and expires_at > to_timestamp($2 / 1000.0) order by created_at desc limit 24",
    [workspaceId, now],
  );
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    label: row.label,
    createdAt: Number(row.created_ms),
    expiresAt: Number(row.expires_ms),
  }));
}

async function listPresence(
  sql: Sql,
  workspace: WorkspaceRow,
  now: number,
): Promise<PublicPresence[]> {
  await sql.query(
    "delete from fenix_workspace_presence where workspace_id=$1 and seen_at < to_timestamp($2 / 1000.0)",
    [workspace.id, now - PRESENCE_TTL_MS],
  );
  const rows = await sql.query<{ user_hash: string; sessions: number; last_ms: number }>(
    "select user_hash, count(*)::int as sessions, (extract(epoch from max(seen_at))*1000)::bigint as last_ms from fenix_workspace_presence where workspace_id=$1 group by user_hash",
    [workspace.id],
  );
  const byHash = new Map(rows.map((row) => [row.user_hash, row]));
  const out: PublicPresence[] = [];
  const owner = byHash.get(workspace.owner_hash);
  if (owner) {
    out.push({
      memberId: "owner",
      role: "owner",
      sessions: Number(owner.sessions),
      lastSeen: Number(owner.last_ms),
    });
  }
  const memberRows = await sql.query<MemberRow>(
    "select id, user_hash, role, label from fenix_workspace_members where workspace_id=$1 and revoked_at is null",
    [workspace.id],
  );
  for (const member of memberRows) {
    const live = byHash.get(member.user_hash);
    if (!live) continue;
    out.push({
      memberId: member.id,
      role: member.role,
      sessions: Number(live.sessions),
      lastSeen: Number(live.last_ms),
    });
  }
  return out;
}

async function listAudit(sql: Sql, workspaceId: string): Promise<PublicAudit[]> {
  const rows = await sql.query<{
    id: string;
    at_ms: number;
    actor: string;
    kind: string;
    detail: string;
  }>(
    "select id, (extract(epoch from at)*1000)::bigint as at_ms, actor, kind, detail from fenix_workspace_audit where workspace_id=$1 order by at desc limit $2",
    [workspaceId, MAX_AUDIT],
  );
  return rows.map((row) => ({
    id: row.id,
    at: Number(row.at_ms),
    actor: row.actor,
    kind: row.kind,
    detail: row.detail,
  }));
}

function publicWorkspace(
  workspace: WorkspaceRow,
  role: WorkspaceRole,
  files: ProjectFile[],
  extra: Record<string, unknown> = {},
) {
  return {
    id: workspace.id,
    name: workspace.name,
    role,
    canWrite: canWrite(role),
    casVersion: workspace.cas_version,
    casHash: workspace.cas_hash,
    files,
    ...extra,
  };
}

export async function handleWorkspaceCollection(
  request: Request,
  deps: WorkspaceDeps = {},
): Promise<Response> {
  const ready = await resolveSql(deps);
  if (!ready.ok) return ready.response;
  const { sql } = ready;
  const now = deps.now?.() ?? Date.now();
  const owner = ownerFromRequest(request);
  if (!owner) return json({ error: "Identità assente." }, 401);
  const userHash = workspaceUserHash(owner);

  if (request.method === "GET") {
    const owned = await sql.query<{ id: string; name: string; cas_version: number }>(
      "select id, name, cas_version::int as cas_version from fenix_workspaces where owner_hash=$1 order by updated_at desc limit 24",
      [userHash],
    );
    const shared = await sql.query<{ id: string; name: string; role: MemberRole }>(
      "select w.id, w.name, m.role from fenix_workspace_members m join fenix_workspaces w on w.id=m.workspace_id where m.user_hash=$1 and m.revoked_at is null order by m.joined_at desc limit 24",
      [userHash],
    );
    return json({
      owned: owned.map((row) => ({ id: row.id, name: row.name, role: "owner" as const })),
      shared: shared.map((row) => ({ id: row.id, name: row.name, role: row.role })),
    });
  }

  if (request.method !== "POST") return json({ error: "Metodo non consentito." }, 405);
  if (!sameOrigin(request)) return json({ error: "Origine non consentita." }, 403);
  const body = await readBoundedBody(request);
  if (!body) return json({ error: "JSON non valido o troppo grande." }, 400);
  const name = safeName(body.name);
  const projectId = String(body.projectId || "");
  if (!name || !PROJECT_ID_RE.test(projectId)) {
    return json({ error: "Nome o progetto non validi." }, 400);
  }
  const existing = await sql.query<WorkspaceRow>(
    "select id, owner_hash, project_id, name, tree_json, cas_version::int as cas_version, cas_hash from fenix_workspaces where owner_hash=$1 and project_id=$2 limit 1",
    [userHash, projectId],
  );
  if (existing[0]) {
    const files = parseTree(existing[0].tree_json);
    const doc = await ensureDoc(sql, existing[0].id, now);
    return json(publicWorkspace(existing[0], "owner", files, { doc: publicDoc(doc) }));
  }
  const ingested = ingestProjectFiles(Array.isArray(body.files) ? (body.files as ProjectFile[]) : []);
  if (!ingested.files.length) return json({ error: "Albero vuoto o non valido." }, 400);
  const id = deps.id?.() ?? `w${randomBytes(12).toString("hex")}`;
  if (!WORKSPACE_ID_RE.test(id)) return json({ error: "Identificativo non valido." }, 500);
  const casHash = treeHash(ingested.files);
  const rows = await sql.query<WorkspaceRow>(
    "insert into fenix_workspaces (id, owner_hash, project_id, name, tree_json, cas_version, cas_hash, created_at, updated_at) values ($1,$2,$3,$4,$5,1,$6,to_timestamp($7 / 1000.0),to_timestamp($7 / 1000.0)) returning id, owner_hash, project_id, name, tree_json, cas_version::int as cas_version, cas_hash",
    [id, userHash, projectId, name, JSON.stringify(ingested.files), casHash, now],
  );
  const created = rows[0];
  if (!created) return json({ error: "Workspace non salvato." }, 500);
  await sql.query(
    "insert into fenix_workspace_docs (workspace_id, content, version, ops_json, updated_at) values ($1,'',0,'[]',to_timestamp($2 / 1000.0)) on conflict (workspace_id) do nothing",
    [created.id, now],
  );
  await audit(sql, created.id, actorPrefix(userHash), "create", "Studio condiviso creato", now, randomUUID());
  const doc = await ensureDoc(sql, created.id, now);
  return json(publicWorkspace(created, "owner", ingested.files, { doc: publicDoc(doc) }), 201);
}

export async function handleWorkspaceRequest(
  request: Request,
  workspaceId: string,
  deps: WorkspaceDeps = {},
): Promise<Response> {
  const ready = await resolveSql(deps);
  if (!ready.ok) return ready.response;
  const { sql } = ready;
  const now = deps.now?.() ?? Date.now();
  const mintId = () => deps.id?.() ?? randomUUID();
  const mintToken = () => deps.token?.() ?? randomBytes(32).toString("hex");

  if (request.method === "GET") {
    const access = await resolveAccess(sql, request, workspaceId);
    if (access.state === "anon") return json({ error: "Identità assente." }, 401);
    if (access.state === "none") return json({ error: "Workspace non trovato." }, 404);
    if (access.state === "forbidden") return json({ error: "Accesso negato." }, 403);
    const files = parseTree(access.workspace.tree_json);
    const members = await listMembers(sql, access.workspace, access.userHash);
    const presence = await listPresence(sql, access.workspace, now);
    const doc = await ensureDoc(sql, access.workspace.id, now);
    const extra: Record<string, unknown> = { presence, members, doc: publicDoc(doc) };
    if (access.role === "owner") {
      extra.invites = await listInvites(sql, access.workspace.id, now);
      extra.audit = await listAudit(sql, access.workspace.id);
    }
    return json(publicWorkspace(access.workspace, access.role, files, extra), 200, {
      ETag: `"${access.workspace.cas_version}"`,
    });
  }

  if (request.method === "PUT") {
    if (!sameOrigin(request)) return json({ error: "Origine non consentita." }, 403);
    const access = await resolveAccess(sql, request, workspaceId);
    if (access.state === "anon") return json({ error: "Identità assente." }, 401);
    if (access.state === "none") return json({ error: "Workspace non trovato." }, 404);
    if (access.state === "forbidden") return json({ error: "Accesso negato." }, 403);
    if (!canWrite(access.role)) return json({ error: "Sola lettura." }, 403);
    const match = parseIfMatch(request.headers.get("if-match"));
    if (!match) return json({ error: "Serve If-Match." }, 428);
    if (
      !ifMatchSatisfied(match, {
        version: access.workspace.cas_version,
        hash: access.workspace.cas_hash,
      })
    ) {
      await audit(
        sql,
        access.workspace.id,
        actorPrefix(access.userHash),
        "conflict",
        "Scrittura in conflitto",
        now,
        mintId(),
      );
      return json(
        {
          error: "Conflitto. Ricarica l’albero.",
          casVersion: access.workspace.cas_version,
          casHash: access.workspace.cas_hash,
        },
        409,
        { ETag: `"${access.workspace.cas_version}"` },
      );
    }
    const body = await readBoundedBody(request);
    if (!body) return json({ error: "JSON non valido o troppo grande." }, 400);
    const pathRaw = String(body.path || "");
    const content = typeof body.content === "string" ? body.content : "";
    const canon = canonicalizePath(pathRaw);
    if (!canon.ok) return json({ error: `Percorso non valido: ${canon.reason}` }, 400);
    const check = inspectFile(canon.path, content);
    if (!check.ok) return json({ error: `File rifiutato: ${check.reason}` }, 400);
    const current = parseTree(access.workspace.tree_json);
    const nextMap = new Map(current.map((file) => [file.path, file]));
    nextMap.set(canon.path, { path: canon.path, content });
    const ingested = ingestProjectFiles([...nextMap.values()]);
    if (!ingested.files.length) return json({ error: "Albero non valido." }, 400);
    const nextHash = treeHash(ingested.files);
    const updated = await sql.query<WorkspaceRow>(
      "update fenix_workspaces set tree_json=$1, cas_version=cas_version+1, cas_hash=$2, updated_at=to_timestamp($3 / 1000.0) where id=$4 and cas_version=$5 returning id, owner_hash, project_id, name, tree_json, cas_version::int as cas_version, cas_hash",
      [JSON.stringify(ingested.files), nextHash, now, access.workspace.id, access.workspace.cas_version],
    );
    const row = updated[0];
    if (!row) {
      await audit(
        sql,
        access.workspace.id,
        actorPrefix(access.userHash),
        "conflict",
        "Scrittura in conflitto",
        now,
        mintId(),
      );
      return json({ error: "Conflitto. Ricarica l’albero." }, 409);
    }
    await audit(
      sql,
      row.id,
      actorPrefix(access.userHash),
      "write",
      `Aggiornato ${canon.path}`,
      now,
      mintId(),
    );
    const doc = await ensureDoc(sql, row.id, now);
    return json(publicWorkspace(row, access.role, ingested.files, { doc: publicDoc(doc) }), 200, {
      ETag: `"${row.cas_version}"`,
    });
  }

  if (request.method !== "POST") return json({ error: "Metodo non consentito." }, 405);
  if (!sameOrigin(request)) return json({ error: "Origine non consentita." }, 403);
  const body = await readBoundedBody(request);
  if (!body) return json({ error: "JSON non valido o troppo grande." }, 400);

  if (body.op === "join") {
    const owner = ownerFromRequest(request);
    if (!owner) return json({ error: "Identità assente." }, 401);
    const token = String(body.token || "").toLowerCase();
    if (!TOKEN_RE.test(token)) return json({ error: "Invito non valido." }, 400);
    const workspace = await readWorkspace(sql, workspaceId);
    if (!workspace) return json({ error: "Workspace non trovato." }, 404);
    const userHash = workspaceUserHash(owner);
    if (workspace.owner_hash === userHash) {
      return json({ error: "Sei già il titolare." }, 409);
    }
    const invites = await sql.query<{ id: string; role: MemberRole; label: string }>(
      "select id, role, label from fenix_workspace_invites where workspace_id=$1 and token_hash=$2 and revoked_at is null and consumed_at is null and expires_at > to_timestamp($3 / 1000.0) limit 1",
      [workspaceId, inviteHash(workspaceId, token), now],
    );
    const invite = invites[0];
    if (!invite) return json({ error: "Invito scaduto o revocato." }, 401);
    const consumed = await sql.query<{ id: string }>(
      "update fenix_workspace_invites set consumed_at=to_timestamp($3 / 1000.0), consumed_by=$4 where id=$1 and workspace_id=$2 and consumed_at is null and revoked_at is null returning id",
      [invite.id, workspaceId, now, userHash],
    );
    if (!consumed[0]) return json({ error: "Invito già usato." }, 409);
    const memberId = mintId();
    if (!MEMBER_ID_RE.test(memberId)) return json({ error: "Membro non valido." }, 500);
    await sql.query(
      "insert into fenix_workspace_members (id, workspace_id, user_hash, role, label, joined_at) values ($1,$2,$3,$4,$5,to_timestamp($6 / 1000.0)) on conflict (workspace_id, user_hash) do update set role=excluded.role, label=excluded.label, revoked_at=null, joined_at=to_timestamp($6 / 1000.0)",
      [memberId, workspaceId, userHash, invite.role, invite.label, now],
    );
    await audit(
      sql,
      workspaceId,
      actorPrefix(userHash),
      "join",
      `Ingresso ${invite.role}`,
      now,
      mintId(),
    );
    const files = parseTree(workspace.tree_json);
    const doc = await ensureDoc(sql, workspaceId, now);
    return json(publicWorkspace(workspace, invite.role, files, { joined: true, doc: publicDoc(doc) }));
  }

  const access = await resolveAccess(sql, request, workspaceId);
  if (access.state === "anon") return json({ error: "Identità assente." }, 401);
  if (access.state === "none") return json({ error: "Workspace non trovato." }, 404);
  if (access.state === "forbidden") return json({ error: "Accesso negato." }, 403);

  if (body.op === "presence") {
    const sessionId = String(body.sessionId || "");
    if (!SESSION_ID_RE.test(sessionId)) return json({ error: "Sessione non valida." }, 400);
    await sql.query(
      "insert into fenix_workspace_presence (workspace_id, session_id, user_hash, seen_at) values ($1,$2,$3,to_timestamp($4 / 1000.0)) on conflict (workspace_id, session_id) do update set user_hash=excluded.user_hash, seen_at=to_timestamp($4 / 1000.0)",
      [access.workspace.id, sessionId, access.userHash, now],
    );
    const presence = await listPresence(sql, access.workspace, now);
    return json({ ok: true, presence });
  }

  if (body.op === "doc") {
    if (!canWrite(access.role)) return json({ error: "Sola lettura." }, 403);
    const opId = String(body.opId || "").toLowerCase();
    const kind = body.kind === "insert" || body.kind === "delete" ? body.kind : null;
    const text = typeof body.text === "string" ? body.text : "";
    const pos = Number(body.pos);
    const base = Number(body.base);
    if (!kind) return json({ error: "Operazione non valida." }, 400);
    if (kind === "insert" && fileLooksLikeSecret(text)) {
      return json({ error: "Testo rifiutato." }, 400);
    }
    return enqueueDoc(access.workspace.id, async () => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const doc = await ensureDoc(sql, access.workspace.id, now);
        const decision = decideDocOp(doc, { id: opId, kind, pos, text, base });
        if (decision.status === "duplicate") {
          return json({ ok: true, duplicate: true, ...publicDoc(doc) });
        }
        if (decision.status === "reject") {
          if (decision.http === 409) {
            await audit(
              sql,
              access.workspace.id,
              actorPrefix(access.userHash),
              "conflict",
              "Appunti in conflitto",
              now,
              mintId(),
            );
          }
          return json({ error: decision.error, ...publicDoc(doc) }, decision.http);
        }
        const saved = await sql.query<DocRow>(
          "update fenix_workspace_docs set content=$1, version=$2, ops_json=$3, updated_at=to_timestamp($4 / 1000.0) where workspace_id=$5 and version=$6 returning content, version::int as version, ops_json",
          [
            decision.next.content,
            decision.next.version,
            serializeDocOps(decision.next.ops),
            now,
            access.workspace.id,
            doc.version,
          ],
        );
        if (!saved[0]) continue;
        await audit(
          sql,
          access.workspace.id,
          actorPrefix(access.userHash),
          "doc",
          auditDocDetail(decision.stored.kind, decision.stored.text.length),
          now,
          mintId(),
        );
        return json({
          ok: true,
          duplicate: false,
          content: decision.next.content,
          version: decision.next.version,
        });
      }
      const latest = await ensureDoc(sql, access.workspace.id, now);
      return json({ error: "Conflitto. Il documento non è cambiato.", ...publicDoc(latest) }, 409);
    });
  }

  if (access.role !== "owner") return json({ error: "Solo il titolare gestisce i ruoli." }, 403);

  if (body.op === "invite") {
    const role = parseMemberRole(body.role);
    const label =
      safeLabel(body.label) || (role === "editor" ? "Può modificare" : "Sola lettura");
    if (!role) return json({ error: "Ruolo non valido." }, 400);
    const token = mintToken();
    if (!TOKEN_RE.test(token)) return json({ error: "Invito generato non valido." }, 500);
    const id = mintId();
    if (!MEMBER_ID_RE.test(id)) return json({ error: "Invito non valido." }, 500);
    const expiresAt = now + INVITE_TTL_MS;
    const rows = await sql.query<InviteRow>(
      "insert into fenix_workspace_invites (id, workspace_id, token_hash, role, label, created_at, expires_at) values ($1,$2,$3,$4,$5,to_timestamp($6 / 1000.0),to_timestamp($7 / 1000.0)) returning id, role, label, (extract(epoch from created_at)*1000)::bigint as created_ms, (extract(epoch from expires_at)*1000)::bigint as expires_ms",
      [id, access.workspace.id, inviteHash(access.workspace.id, token), role, label, now, expiresAt],
    );
    const invite = rows[0];
    if (!invite) return json({ error: "Invito non salvato." }, 500);
    await audit(
      sql,
      access.workspace.id,
      actorPrefix(access.userHash),
      "invite",
      `Invito ${role}`,
      now,
      mintId(),
    );
    return json(
      {
        invite: {
          id: invite.id,
          role: invite.role,
          label: invite.label,
          createdAt: Number(invite.created_ms),
          expiresAt: Number(invite.expires_ms),
        },
        token,
      },
      201,
    );
  }

  if (body.op === "revoke") {
    const memberId = String(body.memberId || "");
    const inviteId = String(body.inviteId || "");
    if (memberId && MEMBER_ID_RE.test(memberId) && memberId !== "owner") {
      const rows = await sql.query<{ id: string }>(
        "update fenix_workspace_members set revoked_at=to_timestamp($3 / 1000.0) where workspace_id=$1 and id=$2 and revoked_at is null returning id",
        [access.workspace.id, memberId, now],
      );
      if (!rows[0]) return json({ error: "Membro non trovato." }, 404);
      await sql.query("delete from fenix_workspace_presence where workspace_id=$1", [
        access.workspace.id,
      ]);
      await audit(
        sql,
        access.workspace.id,
        actorPrefix(access.userHash),
        "revoke",
        "Membro revocato",
        now,
        mintId(),
      );
      return json({ ok: true });
    }
    if (inviteId && MEMBER_ID_RE.test(inviteId)) {
      const rows = await sql.query<{ id: string }>(
        "update fenix_workspace_invites set revoked_at=to_timestamp($3 / 1000.0) where workspace_id=$1 and id=$2 and revoked_at is null returning id",
        [access.workspace.id, inviteId, now],
      );
      if (!rows[0]) return json({ error: "Invito non trovato." }, 404);
      await audit(
        sql,
        access.workspace.id,
        actorPrefix(access.userHash),
        "revoke",
        "Invito revocato",
        now,
        mintId(),
      );
      return json({ ok: true });
    }
    return json({ error: "Revoca non valida." }, 400);
  }

  if (body.op === "role") {
    const memberId = String(body.memberId || "");
    const role = parseMemberRole(body.role);
    if (!MEMBER_ID_RE.test(memberId) || memberId === "owner" || !role) {
      return json({ error: "Ruolo o membro non validi." }, 400);
    }
    const rows = await sql.query<{ id: string }>(
      "update fenix_workspace_members set role=$3 where workspace_id=$1 and id=$2 and revoked_at is null returning id",
      [access.workspace.id, memberId, role],
    );
    if (!rows[0]) return json({ error: "Membro non trovato." }, 404);
    await audit(
      sql,
      access.workspace.id,
      actorPrefix(access.userHash),
      "role",
      `Ruolo ${role}`,
      now,
      mintId(),
    );
    return json({ ok: true, role });
  }

  return json({ error: "Operazione non valida." }, 400);
}
