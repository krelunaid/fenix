/**
 * Production-like PostgreSQL 16 harness for Fenix stores.
 * Fail-closed: real Postgres 16, real migrations, bounded pool, no PGlite.
 * Tokens, passwords and DATABASE_URL never enter the report or logs.
 */
import { createHash, randomBytes } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pg from "pg";
import { pendingMigrations } from "../../../scripts/migration-plan.mjs";
import type { Sql } from "../db.ts";
import {
  appAccessCookieName,
  createAppInvite,
  sharedCloudSubjectHash,
} from "./app-collaboration.ts";
import {
  cloudSubjectHash,
  handleCloudDataRequest,
  readCloudCollection,
  writeCloudCollection,
} from "./cloud-data.ts";
import { OWNER_HEADER } from "./publish-owner.ts";
import {
  handleWorkspaceCollection,
  handleWorkspaceRequest,
} from "./workspace.ts";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../..");
const MIGRATIONS_DIR = join(ROOT, "migrations");

export const PG16_MAJOR = 16;
export const POOL_MAX = 8;
export const SUBJECTS = 24;
export const SITES = 2;
export const COLLECTIONS = ["capi", "ordini", "inventario", "impostazioni"] as const;
export const CAS_WRITERS = 32;
export const WORKSPACE_CAS_WRITERS = 8;
export const THRESHOLDS = {
  p95WriteMs: 500,
  p99WriteMs: 1500,
  p95ReadMs: 300,
  p99ReadMs: 900,
} as const;

const TREE = [
  {
    path: "index.html",
    content:
      "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><title>Argilla Viva</title></head><body><h1>Argilla Viva</h1><button type=\"button\">Salva</button></body></html>",
  },
];

export type PgTarget = {
  connectionString: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

export type LatencyStats = { n: number; p95Ms: number; p99Ms: number; maxMs: number };

export type Fingerprint = {
  checksum: string;
  appDataRows: number;
  workspaceRows: number;
  inviteRows: number;
  docRows: number;
  jobRows: number;
};

export type PostgresReliabilityReport = {
  ok: true;
  postgresMajor: number;
  database: string;
  migrations: string[];
  pool: { max: number; observedMax: number };
  load: {
    sites: number;
    subjects: number;
    collections: number;
    writes: number;
    writeOk: number;
    reads: number;
    casWriters: number;
    casWinners: number;
    casConflicts: number;
    writeMs: LatencyStats;
    readMs: LatencyStats;
    thresholds: typeof THRESHOLDS;
  };
  isolation: { crossHits: number; viewerDenied: number; editorWrote: number };
  idempotency: { replays: number; duplicates: number; jobConflicts: number; docDuplicates: number };
  recovery: {
    toolMajor: number;
    snapshot: Fingerprint;
    mutatedRows: number;
    restored: Fingerprint;
    childDuplicates: number;
    childChecksum: string;
  };
};

type TrackedSql = Sql & { observedMax: number; pool: pg.Pool };

export function redactDatabaseUrl(raw: string): string {
  return String(raw || "").replace(/:([^:@/]+)@/, ":***@");
}

export function parsePostgresUrl(raw: string): PgTarget {
  const trimmed = String(raw || "").trim();
  if (!trimmed) throw new Error("DATABASE_URL assente: il harness PostgreSQL 16 è fail-closed.");
  if (/pglite|memory:|sqlite|file:/i.test(trimmed)) {
    throw new Error("DATABASE_URL non è PostgreSQL 16 reale (PGlite/mock rifiutati).");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("DATABASE_URL non è un URL PostgreSQL valido.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL deve usare postgres:// o postgresql://.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, "")).split("/")[0] || "";
  if (!database) throw new Error("DATABASE_URL senza nome database.");
  return {
    connectionString: trimmed,
    host: url.hostname || "127.0.0.1",
    port: url.port || "5432",
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database,
  };
}

export function parsePostgresMajor(text: string): number | null {
  const match = String(text || "").match(/(\d+)\.\d+/);
  if (!match) return null;
  const major = Number(match[1]);
  return Number.isInteger(major) && major > 0 ? major : null;
}

export function percentile(samples: number[], p: number): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank] ?? 0;
}

export function latencyStats(samples: number[]): LatencyStats {
  return {
    n: samples.length,
    p95Ms: percentile(samples, 95),
    p99Ms: percentile(samples, 99),
    maxMs: samples.reduce((max, value) => (value > max ? value : max), 0),
  };
}

export function restoreDatabaseName(database: string): string {
  const base = database.replace(/_restore$/, "") || "fenix_reliability";
  return `${base}_restore`.slice(0, 63);
}

export function targetWithDatabase(target: PgTarget, database: string): PgTarget {
  const url = new URL(target.connectionString);
  url.pathname = `/${database}`;
  return { ...target, database, connectionString: url.toString() };
}

export function assertReportRedacted(report: unknown, secrets: string[]): void {
  const text = JSON.stringify(report);
  if (/postgres(?:ql)?:\/\/[^:/?]+:[^@]+@/i.test(text)) {
    throw new Error("Il report contiene una DATABASE_URL con password.");
  }
  for (const secret of secrets) {
    if (secret && secret.length >= 6 && text.includes(secret)) {
      throw new Error("Il report contiene una credenziale.");
    }
  }
}

function timed<T>(samples: number[], work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  return work().finally(() => {
    samples.push(Date.now() - started);
  });
}

function hex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

async function jsonResponse(
  response: Response | Promise<Response>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await response;
  const body = (await res.json()) as unknown;
  return {
    status: res.status,
    body: body && typeof body === "object" ? (body as Record<string, unknown>) : {},
  };
}

async function resolvePgTool(name: "pg_dump" | "pg_restore"): Promise<{ path: string; major: number; version: string }> {
  const bin = process.env.FENIX_PG_BIN?.trim();
  const candidate = bin ? join(bin, name) : name;
  try {
    const { stdout, stderr } = await execFileAsync(candidate, ["--version"], {
      env: process.env,
      timeout: 8_000,
    });
    const version = `${stdout} ${stderr}`.trim();
    const major = parsePostgresMajor(version);
    if (major !== PG16_MAJOR) {
      throw new Error(`${name} deve essere PostgreSQL ${PG16_MAJOR}, trovato: ${version || "sconosciuto"}`);
    }
    return { path: candidate, major, version };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${name} PostgreSQL ${PG16_MAJOR} assente o non eseguibile (${message}). Imposta FENIX_PG_BIN o installa postgresql-client-16.`,
    );
  }
}

function toSql(pool: pg.Pool): TrackedSql {
  const tracked = {
    observedMax: 0,
    pool,
  };
  const run = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
    tracked.observedMax = Math.max(tracked.observedMax, pool.totalCount);
    const result = await pool.query(text, params);
    tracked.observedMax = Math.max(tracked.observedMax, pool.totalCount);
    return result.rows as T[];
  };
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<T>(text, values);
  }) as TrackedSql;
  sql.query = run;
  sql.observedMax = 0;
  Object.defineProperty(sql, "observedMax", {
    get: () => tracked.observedMax,
  });
  sql.pool = pool;
  return sql;
}

async function createBoundedPool(connectionString: string): Promise<pg.Pool> {
  pg.types.setTypeParser(20, Number);
  pg.types.setTypeParser(1082, (value: string) => value);
  pg.types.setTypeParser(1186, (value: string) => value);
  const pool = new pg.Pool({
    connectionString,
    max: POOL_MAX,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 8_000,
    allowExitOnIdle: true,
    application_name: "fenix-reliability",
  });
  return pool;
}

async function requirePostgres16(sql: Sql): Promise<{ major: number; version: string }> {
  const rows = await sql.query<{ server_version: string; server_version_num: string | number }>(
    "select current_setting('server_version') as server_version, current_setting('server_version_num') as server_version_num",
  );
  const version = String(rows[0]?.server_version || "");
  const numeric = Number(rows[0]?.server_version_num);
  const major = Math.floor(numeric / 10_000);
  if (major !== PG16_MAJOR) {
    throw new Error(`PostgreSQL ${PG16_MAJOR} richiesto, trovato ${version || numeric || "sconosciuto"}.`);
  }
  return { major, version };
}

async function applyMigrations(sql: TrackedSql): Promise<string[]> {
  const client = await sql.pool.connect();
  try {
    await client.query(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const appliedRows = await client.query<{ name: string }>("select name from _migrations");
    const applied = appliedRows.rows.map((row) => row.name);
    const entries = await readdir(MIGRATIONS_DIR);
    const pending = pendingMigrations(entries, applied);
    const names: string[] = [...applied];
    for (const { name } of pending) {
      const text = await readFile(join(MIGRATIONS_DIR, name), "utf8");
      try {
        await client.query("begin");
        await client.query(text);
        await client.query("insert into _migrations (name) values ($1)", [name]);
        await client.query("commit");
        names.push(name);
      } catch (error) {
        try {
          await client.query("rollback");
        } catch {
          /* keep original */
        }
        throw error;
      }
    }
    return [...new Set(names)].sort();
  } finally {
    client.release();
  }
}

async function fingerprint(sql: Sql): Promise<Fingerprint> {
  const app = await sql.query<{ site_id: string; subject_hash: string; collection: string; rev: string; data: string }>(
    "select site_id, subject_hash, collection, rev::text as rev, data::text as data from fenix_generated_app_data order by 1,2,3",
  );
  const workspaces = await sql.query<{ id: string; project_id: string; cas_version: number; cas_hash: string }>(
    "select id, project_id, cas_version::int as cas_version, cas_hash from fenix_workspaces order by id",
  );
  const invites = await sql.query<{ id: string; role: string; token_hash: string }>(
    "select id, role, token_hash from fenix_app_access order by id",
  );
  const docs = await sql.query<{ workspace_id: string; version: number; content: string }>(
    "select workspace_id, version::int as version, content from fenix_workspace_docs order by workspace_id",
  );
  const jobs = await sql.query<{ idempotency_key: string; version: number }>(
    "select idempotency_key, version::int as version from release_jobs order by idempotency_key",
  );
  const material = JSON.stringify({ app, workspaces, invites, docs, jobs });
  return {
    checksum: createHash("sha256").update(material).digest("hex"),
    appDataRows: app.length,
    workspaceRows: workspaces.length,
    inviteRows: invites.length,
    docRows: docs.length,
    jobRows: jobs.length,
  };
}

function originRequest(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  const next = new Headers(headers);
  next.set("origin", "https://fenix.test");
  next.set("sec-fetch-site", "same-origin");
  if (body !== undefined) next.set("content-type", "application/json");
  return new Request(`https://fenix.test${path}`, {
    method,
    headers: next,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function runPgTool(
  tool: { path: string },
  args: string[],
  target: PgTarget,
): Promise<void> {
  const env = {
    ...process.env,
    PATH: process.env.PATH || "",
    LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || "",
    PGHOST: target.host,
    PGPORT: target.port,
    PGUSER: target.user,
    PGDATABASE: target.database,
    PGPASSWORD: target.password,
    PGSSLMODE: "disable",
  };
  await new Promise<void>((resolve, reject) => {
    const child = spawn(tool.path, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const combined = `${stdout}\n${stderr}`;
      if (target.password && combined.includes(target.password)) {
        reject(new Error(`${tool.path} ha stampato una credenziale.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${tool.path} exit ${code}: ${redactDatabaseUrl(combined).slice(0, 400)}`));
        return;
      }
      resolve();
    });
  });
}

export async function runRestoredProcessCheck(
  databaseUrl: string,
  expected: Fingerprint,
): Promise<{ ok: boolean; fingerprint: Fingerprint; duplicates: number }> {
  const target = parsePostgresUrl(databaseUrl);
  const pool = await createBoundedPool(target.connectionString);
  const sql = toSql(pool);
  try {
    await requirePostgres16(sql);
    const current = await fingerprint(sql);
    if (current.checksum !== expected.checksum || current.appDataRows !== expected.appDataRows) {
      throw new Error("Il processo ripristinato non coincide con lo snapshot.");
    }
    const rows = await sql.query<{ site_id: string; subject_hash: string; collection: string }>(
      "select site_id, subject_hash, collection from fenix_generated_app_data",
    );
    const replays = await Promise.all(
      rows.map((row) => writeCloudCollection(sql, row.site_id, row.subject_hash, row.collection, 0, { replay: true })),
    );
    const duplicates = replays.filter((row) => "conflict" in row).length;
    if (duplicates !== rows.length) {
      throw new Error("Il riavvio ha creato duplicati invece di conflitti CAS.");
    }
    const after = await fingerprint(sql);
    if (after.checksum !== expected.checksum || after.appDataRows !== expected.appDataRows) {
      throw new Error("Il riavvio ha mutato lo snapshot ripristinato.");
    }
    return { ok: true, fingerprint: after, duplicates: 0 };
  } finally {
    await pool.end();
  }
}

export async function runPostgresReliability(options: {
  databaseUrl?: string;
  artifactPath?: string;
} = {}): Promise<PostgresReliabilityReport> {
  const target = parsePostgresUrl(options.databaseUrl ?? process.env.DATABASE_URL ?? "");
  const dump = await resolvePgTool("pg_dump");
  const restore = await resolvePgTool("pg_restore");
  const pool = await createBoundedPool(target.connectionString);
  const sql = toSql(pool);
  const secrets = [target.password, target.connectionString].filter((value) => value.length >= 6);
  let dumpFile = "";
  try {
    const server = await requirePostgres16(sql);
    const migrations = await applyMigrations(sql);
    const expectedMigrations = [
      "0001_auth.sql",
      "0002_release_jobs.sql",
      "0003_github_connect_nonces.sql",
      "0004_generated_app_data.sql",
      "0005_app_collaboration.sql",
      "0006_project_workspaces.sql",
      "0007_workspace_shared_doc.sql",
    ];
    for (const name of expectedMigrations) {
      if (!migrations.includes(name)) throw new Error(`Migrazione assente: ${name}`);
    }
    await sql.query(
      "truncate table fenix_generated_app_data, fenix_app_access, fenix_workspaces, release_jobs, github_connect_nonces restart identity cascade",
    );

    const run = hex(4);
    const sites = Array.from({ length: SITES }, (_, index) => `pg16s${index}${run}`);
    const sessions = Array.from({ length: SUBJECTS }, (_, index) =>
      index.toString(16).padStart(2, "0") + "ab".repeat(31),
    );
    const writeMs: number[] = [];
    const readMs: number[] = [];

    const writes = sites.flatMap((siteId, siteIndex) =>
      sessions.flatMap((session, subjectIndex) => {
        const subject = cloudSubjectHash(siteId, session);
        return COLLECTIONS.map((collection, collectionIndex) =>
          timed(writeMs, () =>
            writeCloudCollection(sql, siteId, subject, collection, 0, {
              site: siteIndex,
              subject: subjectIndex,
              collection: collectionIndex,
              run,
            }),
          ),
        );
      }),
    );
    const inserted = await Promise.all(writes);
    const writeOk = inserted.filter((row) => !("error" in row) && !("conflict" in row)).length;
    if (writeOk !== sites.length * sessions.length * COLLECTIONS.length) {
      throw new Error(`Scritture iniziali incomplete: ${writeOk}.`);
    }

    const reads = await Promise.all(
      sites.flatMap((siteId) =>
        sessions.flatMap((session) => {
          const subject = cloudSubjectHash(siteId, session);
          return COLLECTIONS.map((collection) =>
            timed(readMs, () => readCloudCollection(sql, siteId, subject, collection)),
          );
        }),
      ),
    );
    if (reads.some((row) => row.rev !== 1)) throw new Error("Revisioni iniziali non isolate.");

    let crossHits = 0;
    for (let siteIndex = 0; siteIndex < sites.length; siteIndex += 1) {
      const siteId = sites[siteIndex]!;
      for (let subjectIndex = 0; subjectIndex < sessions.length; subjectIndex += 1) {
        const subject = cloudSubjectHash(siteId, sessions[subjectIndex]!);
        for (let collectionIndex = 0; collectionIndex < COLLECTIONS.length; collectionIndex += 1) {
          const row = await readCloudCollection(sql, siteId, subject, COLLECTIONS[collectionIndex]!);
          const data = row.data as { site?: number; subject?: number; collection?: number } | null;
          if (
            !data ||
            data.site !== siteIndex ||
            data.subject !== subjectIndex ||
            data.collection !== collectionIndex
          ) {
            crossHits += 1;
          }
        }
        const otherSite = sites[(siteIndex + 1) % sites.length]!;
        if (otherSite !== siteId) {
          const leaked = await readCloudCollection(sql, otherSite, subject, "capi");
          if (leaked.rev !== 0) crossHits += 1;
        }
      }
    }

    const contestedSite = sites[0]!;
    const contestedSubject = cloudSubjectHash(contestedSite, sessions[0]!);
    const burst = await Promise.all(
      Array.from({ length: CAS_WRITERS }, (_, contender) =>
        timed(writeMs, () =>
          writeCloudCollection(sql, contestedSite, contestedSubject, "capi", 1, { contender, run }),
        ),
      ),
    );
    const casWinners = burst.filter((row) => !("error" in row) && !("conflict" in row)).length;
    const casConflicts = burst.filter((row) => "conflict" in row).length;
    if (casWinners !== 1 || casConflicts !== CAS_WRITERS - 1) {
      throw new Error(`CAS cloud: attesi 1 vincitore e ${CAS_WRITERS - 1} conflitti.`);
    }

    const replayTargets = await sql.query<{ site_id: string; subject_hash: string; collection: string }>(
      "select site_id, subject_hash, collection from fenix_generated_app_data where site_id = any($1::text[])",
      [sites],
    );
    const replayed = await Promise.all(
      replayTargets.map((row) => writeCloudCollection(sql, row.site_id, row.subject_hash, row.collection, 0, { replay: true })),
    );
    const replayConflicts = replayed.filter((row) => "conflict" in row).length;
    if (replayConflicts !== replayTargets.length) {
      throw new Error("Replay rev=0 non è idempotente.");
    }

    const collabSite = `pg16c${run}`;
    const editorToken = hex(32);
    const viewerToken = hex(32);
    await createAppInvite(sql, collabSite, "editor", "Editor", {
      now: Date.now(),
      token: editorToken,
      id: `ed${run}abcdefgh`,
    });
    await createAppInvite(sql, collabSite, "viewer", "Viewer", {
      now: Date.now(),
      token: viewerToken,
      id: `vw${run}abcdefgh`,
    });
    const cloudDeps = { sql, durable: true, siteExists: async () => true };
    const viewerSave = await handleCloudDataRequest(
      originRequest(
        "POST",
        `/api/app-data/${collabSite}`,
        { op: "save", col: "capi", rev: 0, data: [{ leaked: true }] },
        { cookie: `${appAccessCookieName(collabSite)}=${viewerToken}` },
      ),
      collabSite,
      cloudDeps,
    );
    const editorSave = await handleCloudDataRequest(
      originRequest(
        "POST",
        `/api/app-data/${collabSite}`,
        { op: "save", col: "capi", rev: 0, data: [{ ok: true, run }] },
        { cookie: `${appAccessCookieName(collabSite)}=${editorToken}` },
      ),
      collabSite,
      cloudDeps,
    );
    if (viewerSave.status !== 403) throw new Error("Il viewer condiviso ha scritto.");
    if (editorSave.status !== 200) throw new Error("L'editor condiviso non ha scritto.");
    const shared = await readCloudCollection(sql, collabSite, sharedCloudSubjectHash(collabSite), "capi");
    if (shared.rev !== 1) throw new Error("Dataset condiviso assente.");
    const privateSession = `${"cd".repeat(32)}`;
    const privateSave = await handleCloudDataRequest(
      originRequest(
        "POST",
        `/api/app-data/${collabSite}`,
        { op: "save", col: "capi", rev: 0, data: [{ private: true }] },
        { cookie: `fenix_app_${createHash("sha256").update(collabSite).digest("hex").slice(0, 16)}=${privateSession}` },
      ),
      collabSite,
      cloudDeps,
    );
    if (privateSave.status !== 200) throw new Error("La sessione privata non ha scritto.");
    const privateRow = await readCloudCollection(
      sql,
      collabSite,
      cloudSubjectHash(collabSite, privateSession),
      "capi",
    );
    if (privateRow.rev !== 1 || shared.rev !== 1) throw new Error("Isolamento shared/private fallito.");

    const ownerA = "aa".repeat(16);
    const ownerB = "bb".repeat(16);
    const ownerC = "cc".repeat(16);
    let seq = 0;
    const nextId = () => {
      seq += 1;
      return `w${run}${seq.toString(16).padStart(8, "0")}`;
    };
    const wsDeps = {
      sql,
      durable: true,
      now: () => 1_800_000_000_000,
      token: () => hex(32),
      id: nextId,
    };
    const created = await jsonResponse(
      await handleWorkspaceCollection(
        originRequest(
          "POST",
          "/api/workspace",
          { name: "Argilla Viva", projectId: `proj-${run}-a`, files: TREE },
          { [OWNER_HEADER]: ownerA },
        ),
        wsDeps,
      ),
    );
    if (created.status !== 201) {
      throw new Error(`Workspace non creato: ${created.status} ${String(created.body.error || "")}`);
    }
    const wsId = String(created.body.id || "");
    const replayCreate = await jsonResponse(
      await handleWorkspaceCollection(
        originRequest(
          "POST",
          "/api/workspace",
          { name: "Argilla Viva", projectId: `proj-${run}-a`, files: TREE },
          { [OWNER_HEADER]: ownerA },
        ),
        wsDeps,
      ),
    );
    if (replayCreate.status !== 200 || replayCreate.body.id !== wsId) {
      throw new Error("Create workspace non è idempotente.");
    }

    const editorInvite = await jsonResponse(
      await handleWorkspaceRequest(
        originRequest("POST", `/api/workspace/${wsId}`, { op: "invite", role: "editor" }, { [OWNER_HEADER]: ownerA }),
        wsId,
        wsDeps,
      ),
    );
    const viewerInvite = await jsonResponse(
      await handleWorkspaceRequest(
        originRequest("POST", `/api/workspace/${wsId}`, { op: "invite", role: "viewer" }, { [OWNER_HEADER]: ownerA }),
        wsId,
        wsDeps,
      ),
    );
    if (editorInvite.status !== 201 || viewerInvite.status !== 201) {
      throw new Error(`Invito workspace fallito: ${editorInvite.status}/${viewerInvite.status}`);
    }
    const editorJoin = await jsonResponse(
      await handleWorkspaceRequest(
        originRequest(
          "POST",
          `/api/workspace/${wsId}`,
          { op: "join", token: String(editorInvite.body.token || ""), role: "owner" },
          { [OWNER_HEADER]: ownerB },
        ),
        wsId,
        wsDeps,
      ),
    );
    const viewerJoin = await jsonResponse(
      await handleWorkspaceRequest(
        originRequest(
          "POST",
          `/api/workspace/${wsId}`,
          { op: "join", token: String(viewerInvite.body.token || ""), role: "owner" },
          { [OWNER_HEADER]: ownerC },
        ),
        wsId,
        wsDeps,
      ),
    );
    if (editorJoin.status !== 200 || viewerJoin.status !== 200) {
      throw new Error(
        `Join workspace fallito: ${editorJoin.status}/${viewerJoin.status} ${String(editorJoin.body.error || "")} ${String(viewerJoin.body.error || "")}`,
      );
    }
    const viewerWrite = await jsonResponse(
      await handleWorkspaceRequest(
        originRequest(
          "PUT",
          `/api/workspace/${wsId}`,
          { path: "index.html", content: TREE[0]!.content.replace("Salva", "No") },
          { [OWNER_HEADER]: ownerC, "if-match": `"${created.body.casVersion}"` },
        ),
        wsId,
        wsDeps,
      ),
    );
    if (viewerWrite.status !== 403) throw new Error("Il viewer workspace ha scritto.");

    const casVersion = Number(created.body.casVersion);
    const workspaceBurst = await Promise.all(
      Array.from({ length: WORKSPACE_CAS_WRITERS }, (_, index) =>
        jsonResponse(
          handleWorkspaceRequest(
            originRequest(
              "PUT",
              `/api/workspace/${wsId}`,
              { path: "index.html", content: TREE[0]!.content.replace("Salva", `S${index}`) },
              { [OWNER_HEADER]: ownerB, "if-match": `"${casVersion}"` },
            ),
            wsId,
            wsDeps,
          ),
        ),
      ),
    );
    const wsWinners = workspaceBurst.filter((row) => row.status === 200).length;
    const wsConflicts = workspaceBurst.filter((row) => row.status === 409).length;
    if (wsWinners !== 1 || wsConflicts !== WORKSPACE_CAS_WRITERS - 1) {
      throw new Error(`CAS workspace: attesi 1 vincitore e ${WORKSPACE_CAS_WRITERS - 1} conflitti.`);
    }

    const opId = `o${run}${"ab".repeat(6)}`;
    const firstDoc = await jsonResponse(
      await handleWorkspaceRequest(
        originRequest(
          "POST",
          `/api/workspace/${wsId}`,
          { op: "doc", opId, kind: "insert", pos: 0, text: "Argilla", base: 0 },
          { [OWNER_HEADER]: ownerB },
        ),
        wsId,
        wsDeps,
      ),
    );
    const replayDoc = await jsonResponse(
      await handleWorkspaceRequest(
        originRequest(
          "POST",
          `/api/workspace/${wsId}`,
          { op: "doc", opId, kind: "insert", pos: 0, text: "Argilla", base: 0 },
          { [OWNER_HEADER]: ownerB },
        ),
        wsId,
        wsDeps,
      ),
    );
    if (firstDoc.status !== 200 || firstDoc.body.duplicate) {
      throw new Error(`Doc insert iniziale fallito: ${firstDoc.status} ${String(firstDoc.body.error || "")}`);
    }
    if (replayDoc.status !== 200 || replayDoc.body.duplicate !== true) {
      throw new Error("Replay doc non idempotente.");
    }
    if (replayDoc.body.content !== firstDoc.body.content) throw new Error("Replay doc ha mutato il testo.");

    const otherOwner = await jsonResponse(
      await handleWorkspaceRequest(
        originRequest("GET", `/api/workspace/${wsId}`, undefined, { [OWNER_HEADER]: "dd".repeat(16) }),
        wsId,
        wsDeps,
      ),
    );
    if (otherOwner.status !== 403 && otherOwner.status !== 404) {
      throw new Error("Isolamento titolare workspace fallito.");
    }

    const jobKey = `job-${run}`;
    const jobInserts = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        sql.query(
          "insert into release_jobs (id, idempotency_key, owner_hash, job) values ($1,$2,$3,$4::jsonb)",
          [`job${run}${index}`, jobKey, "ab".repeat(16), JSON.stringify({ run, index })],
        ),
      ),
    );
    const jobOk = jobInserts.filter((row) => row.status === "fulfilled").length;
    const jobConflicts = jobInserts.filter((row) => row.status === "rejected").length;
    if (jobOk !== 1 || jobConflicts !== 7) throw new Error("Idempotency_key release_jobs non ha un solo vincitore.");

    if (sql.observedMax > POOL_MAX) {
      throw new Error(`Pool ${sql.observedMax} oltre il massimo ${POOL_MAX}.`);
    }
    const writeStats = latencyStats(writeMs);
    const readStats = latencyStats(readMs);
    if (writeStats.p95Ms > THRESHOLDS.p95WriteMs || writeStats.p99Ms > THRESHOLDS.p99WriteMs) {
      throw new Error(`p95/p99 write oltre soglia: ${writeStats.p95Ms}/${writeStats.p99Ms}ms.`);
    }
    if (readStats.p95Ms > THRESHOLDS.p95ReadMs || readStats.p99Ms > THRESHOLDS.p99ReadMs) {
      throw new Error(`p95/p99 read oltre soglia: ${readStats.p95Ms}/${readStats.p99Ms}ms.`);
    }
    if (crossHits !== 0) throw new Error(`Dati incrociati: ${crossHits}.`);

    const snapshot = await fingerprint(sql);
    dumpFile = join(tmpdir(), `fenix-pg16-${run}.dump`);
    await runPgTool(dump, ["--no-owner", "--no-acl", "-Fc", "-f", dumpFile, "-d", target.database], target);

    const mutation = await writeCloudCollection(
      sql,
      contestedSite,
      contestedSubject,
      "audit",
      0,
      { mutated: true, run },
    );
    if ("error" in mutation || "conflict" in mutation) throw new Error("Mutazione post-snapshot fallita.");
    const mutated = await fingerprint(sql);
    if (mutated.checksum === snapshot.checksum || mutated.appDataRows <= snapshot.appDataRows) {
      throw new Error("La mutazione post-snapshot non ha cambiato i dati.");
    }

    const restoreName = restoreDatabaseName(target.database);
    await sql.query(`drop database if exists ${quoteIdent(restoreName)} with (force)`);
    await sql.query(`create database ${quoteIdent(restoreName)}`);
    const restoreTarget = targetWithDatabase(target, restoreName);
    await runPgTool(restore, ["--no-owner", "--no-acl", "-d", restoreName, dumpFile], restoreTarget);

    const restorePool = await createBoundedPool(restoreTarget.connectionString);
    const restoreSql = toSql(restorePool);
    let restored: Fingerprint;
    try {
      restored = await fingerprint(restoreSql);
    } finally {
      await restorePool.end();
    }
    if (restored.checksum !== snapshot.checksum) {
      throw new Error("Checksum restore diverso dallo snapshot.");
    }
    if (
      restored.appDataRows !== snapshot.appDataRows ||
      restored.workspaceRows !== snapshot.workspaceRows ||
      restored.docRows !== snapshot.docRows
    ) {
      throw new Error("Row count restore diverso dallo snapshot.");
    }
    if (restored.checksum === mutated.checksum) {
      throw new Error("Il restore ha seguito le mutazioni successive.");
    }

    const child = await spawnRestoredChild(restoreTarget.connectionString, snapshot);
    if (!child.ok || child.duplicates !== 0 || child.fingerprint.checksum !== snapshot.checksum) {
      throw new Error("Il processo applicativo ripristinato ha duplicato o perso righe.");
    }

    const report: PostgresReliabilityReport = {
      ok: true,
      postgresMajor: server.major,
      database: target.database,
      migrations,
      pool: { max: POOL_MAX, observedMax: sql.observedMax },
      load: {
        sites: sites.length,
        subjects: sessions.length,
        collections: COLLECTIONS.length,
        writes: inserted.length,
        writeOk,
        reads: reads.length,
        casWriters: CAS_WRITERS,
        casWinners,
        casConflicts,
        writeMs: writeStats,
        readMs: readStats,
        thresholds: THRESHOLDS,
      },
      isolation: { crossHits, viewerDenied: 1, editorWrote: 1 },
      idempotency: {
        replays: replayTargets.length,
        duplicates: 0,
        jobConflicts,
        docDuplicates: 1,
      },
      recovery: {
        toolMajor: dump.major,
        snapshot,
        mutatedRows: mutated.appDataRows,
        restored,
        childDuplicates: child.duplicates,
        childChecksum: child.fingerprint.checksum,
      },
    };
    assertReportRedacted(report, secrets);
    const artifactPath = options.artifactPath ?? join(ROOT, "artifacts/postgres-reliability.json");
    await mkdir(dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    return report;
  } finally {
    if (dumpFile) {
      try {
        await unlink(dumpFile);
      } catch {
        /* ignore */
      }
    }
    await pool.end();
  }
}

function quoteIdent(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error("Nome database non valido.");
  return `"${value.replaceAll('"', '""')}"`;
}

async function spawnRestoredChild(
  databaseUrl: string,
  expected: Fingerprint,
): Promise<{ ok: boolean; fingerprint: Fingerprint; duplicates: number }> {
  const script = join(ROOT, "scripts/postgres-reliability.mjs");
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    FENIX_RELIABILITY_CHILD: "1",
    FENIX_RELIABILITY_EXPECT: JSON.stringify(expected),
  };
  const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", script, "--child"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: ROOT,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const password = parsePostgresUrl(databaseUrl).password;
      if (password && `${stdout}\n${stderr}`.includes(password)) {
        reject(new Error("Il processo figlio ha stampato una credenziale."));
        return;
      }
      if (code !== 0) {
        reject(new Error(`child exit ${code}: ${redactDatabaseUrl(stderr || stdout).slice(0, 400)}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
  const parsed = JSON.parse(stdout) as { ok: boolean; fingerprint: Fingerprint; duplicates: number };
  if (!parsed?.ok) throw new Error(`child stderr ${redactDatabaseUrl(stderr).slice(0, 200)}`);
  return parsed;
}

export async function runPostgresReliabilityCli(argv: string[]): Promise<void> {
  if (argv.includes("--child") || process.env.FENIX_RELIABILITY_CHILD === "1") {
    const expected = JSON.parse(process.env.FENIX_RELIABILITY_EXPECT || "{}") as Fingerprint;
    const result = await runRestoredProcessCheck(process.env.DATABASE_URL || "", expected);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const report = await runPostgresReliability({
    artifactPath: process.env.FENIX_RELIABILITY_ARTIFACT,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.ok,
        postgresMajor: report.postgresMajor,
        pool: report.pool,
        writes: report.load.writeOk,
        casWinners: report.load.casWinners,
        checksum: report.recovery.snapshot.checksum,
        restored: report.recovery.restored.checksum,
      },
      null,
      2,
    )}\n`,
  );
}
