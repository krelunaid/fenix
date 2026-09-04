import type { ProjectFile } from "./files.ts";

export type PortableFieldType = "text" | "integer" | "number" | "boolean" | "json";

export type PortableBackendField = {
  name: string;
  type: PortableFieldType;
  required?: boolean;
};

export type PortableBackendCollection = {
  name: string;
  fields: PortableBackendField[];
};

export type PortableBackendSpec = {
  collections: PortableBackendCollection[];
};

export type PortableMigration = {
  id: string;
  filename: string;
  sql: string;
};

export const PORTABLE_BACKEND_MANIFEST = "backend/fenix.backend.json";
export const PORTABLE_DEPLOY_MANIFEST = "fenix.deploy.json";
export const PORTABLE_BACKEND_VERSION = 5;
export const PORTABLE_SCHEMA_VERSION = 4;

const GENERATED_BACKEND_PATHS = new Set([
  PORTABLE_BACKEND_MANIFEST,
  PORTABLE_DEPLOY_MANIFEST,
  "package.json",
  "backend/package.json",
  "backend/schema.sql",
  "backend/server.mjs",
  "backend/README.md",
]);

const MIGRATION_PATH = /^backend\/migrations\/\d{4}_[a-z0-9_]+\.sql$/;
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,47}$/;
const RESERVED = new Set(["id", "created_at", "updated_at", "version"]);
const FIELD_TYPES = new Set<PortableFieldType>(["text", "integer", "number", "boolean", "json"]);

export function isGeneratedPortablePath(path: string): boolean {
  return GENERATED_BACKEND_PATHS.has(path) || MIGRATION_PATH.test(path);
}

export function validatePortableBackendSpec(spec: PortableBackendSpec): string[] {
  const errors: string[] = [];
  if (!spec || !Array.isArray(spec.collections) || spec.collections.length < 1) {
    return ["Serve almeno una collezione backend."];
  }
  if (spec.collections.length > 12) errors.push("Massimo 12 collezioni backend.");
  const collections = new Set<string>();
  for (const collection of spec.collections) {
    if (!NAME.test(collection?.name || "")) {
      errors.push(`Collezione non valida: ${String(collection?.name || "")}`);
      continue;
    }
    const collectionKey = collection.name.toLowerCase();
    if (collections.has(collectionKey)) errors.push(`Collezione duplicata: ${collection.name}`);
    collections.add(collectionKey);
    if (!Array.isArray(collection.fields) || collection.fields.length < 1) {
      errors.push(`La collezione ${collection.name} non ha campi.`);
      continue;
    }
    if (collection.fields.length > 24) errors.push(`Troppi campi in ${collection.name}.`);
    const fields = new Set<string>();
    for (const field of collection.fields) {
      const fieldKey = String(field?.name || "").toLowerCase();
      if (!NAME.test(field?.name || "") || RESERVED.has(fieldKey)) {
        errors.push(`Campo non valido in ${collection.name}: ${String(field?.name || "")}`);
        continue;
      }
      if (fields.has(fieldKey)) errors.push(`Campo duplicato in ${collection.name}: ${field.name}`);
      fields.add(fieldKey);
      if (!FIELD_TYPES.has(field.type)) {
        errors.push(`Tipo non valido per ${collection.name}.${field.name}.`);
      }
    }
  }
  return errors;
}

export function portableBackendMigrations(spec: PortableBackendSpec): PortableMigration[] {
  const errors = validatePortableBackendSpec(spec);
  if (errors.length) throw new Error(errors.join(" "));
  const tables = spec.collections
    .map(
      (collection) => `CREATE TABLE IF NOT EXISTS "${collection.name}" (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES _fenix_users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);`,
    )
    .join("\n\n");
  return [
    {
      id: "0001_init",
      filename: "0001_init.sql",
      sql: `CREATE TABLE IF NOT EXISTS _fenix_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS _fenix_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES _fenix_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS _fenix_sessions_expiry ON _fenix_sessions(expires_at);

${tables}
`,
    },
    {
      id: "0002_meta",
      filename: "0002_meta.sql",
      sql: `ALTER TABLE _fenix_users ADD COLUMN last_login_at TEXT;

CREATE TABLE IF NOT EXISTS _fenix_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO _fenix_meta(key, value) VALUES ('product', 'fenix-portable');
`,
    },
    {
      id: "0003_password_reset",
      filename: "0003_password_reset.sql",
      sql: `CREATE TABLE IF NOT EXISTS _fenix_password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES _fenix_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS _fenix_password_resets_user ON _fenix_password_resets(user_id);

CREATE TABLE IF NOT EXISTS _fenix_outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS _fenix_auth_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start TEXT NOT NULL
);
`,
    },
    {
      id: "0004_passwordless",
      filename: "0004_passwordless.sql",
      sql: `CREATE TABLE IF NOT EXISTS _fenix_passwordless (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES _fenix_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  salt TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS _fenix_passwordless_user ON _fenix_passwordless(user_id);
`,
    },
  ];
}

function schemaSql(spec: PortableBackendSpec): string {
  return portableBackendMigrations(spec)
    .map((migration) => `-- ${migration.filename}\n${migration.sql.trim()}\n`)
    .join("\n");
}

const SERVER = String.raw`import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.env.FENIX_PUBLIC_ROOT || join(here, ".."));
const manifest = JSON.parse(readFileSync(join(here, "fenix.backend.json"), "utf8"));
const db = new DatabaseSync(process.env.FENIX_DB_PATH || join(here, "fenix.sqlite"));
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
const collections = new Map(manifest.collections.map((c) => [c.name, c]));
const maxBody = 256 * 1024;
const token = process.env.FENIX_API_TOKEN || "";
const allowSignup = process.env.FENIX_ALLOW_SIGNUP !== "false";
const sessionDays = 7;
const serviceId = "00000000-0000-4000-8000-000000000000";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function applyMigrations() {
  const dir = join(here, "migrations");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error("missing");
  const files = readdirSync(dir).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!files.length) throw new Error("missing");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("CREATE TABLE IF NOT EXISTS _fenix_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");
    const known = new Set(files.map((name) => name.slice(0, -4)));
    const applied = db.prepare("SELECT id, checksum FROM _fenix_migrations").all();
    for (const row of applied) {
      if (!known.has(row.id)) throw new Error("unknown");
    }
    const find = db.prepare("SELECT checksum FROM _fenix_migrations WHERE id=?");
    const insert = db.prepare("INSERT INTO _fenix_migrations (id,checksum,applied_at) VALUES (?,?,?)");
    for (const name of files) {
      const id = name.slice(0, -4);
      const sql = readFileSync(join(dir, name), "utf8");
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/im.test(sql)) throw new Error("invalid");
      const sum = sha256(sql);
      const prev = find.get(id);
      if (prev) {
        if (prev.checksum !== sum) throw new Error("checksum");
        continue;
      }
      db.exec(sql);
      insert.run(id, sum, new Date().toISOString());
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
}

let schemaVersion = 0;
try {
  applyMigrations();
  schemaVersion = Number(db.prepare("SELECT COUNT(*) AS n FROM _fenix_migrations").get()?.n || 0);
} catch {
  process.stderr.write(JSON.stringify({ error: "Migrazione fallita" }) + "\n");
  process.exit(1);
}

db.prepare("INSERT OR IGNORE INTO _fenix_users (id,email,password_hash,created_at) VALUES (?,?,?,?)").run(serviceId, "service@fenix.local", "service-only", new Date(0).toISOString());
const hasLastLogin = db.prepare("PRAGMA table_info(_fenix_users)").all().some((col) => col.name === "last_login_at");

function json(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra });
  res.end(JSON.stringify(body));
}

function bearerPrincipal(req) {
  if (!token) return null;
  const raw = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(raw);
  const b = Buffer.from(token);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
    ? { id: serviceId, email: "service@fenix.local", service: true }
    : null;
}

function cookie(req, name) {
  const hit = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name);
  return hit ? decodeURIComponent(hit.slice(1).join("=")) : "";
}

function sessionPrincipal(req) {
  const raw = cookie(req, "fenix_session");
  if (!raw) return null;
  const now = new Date().toISOString();
  const found = db.prepare("SELECT u.id,u.email FROM _fenix_sessions s JOIN _fenix_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").get(sha256(raw), now);
  return found ? { id: found.id, email: found.email, service: false } : null;
}

function principal(req) {
  return bearerPrincipal(req) || sessionPrincipal(req);
}

function passwordDigest(password, salt) {
  return scryptSync(password, salt, 32).toString("hex");
}

function passwordRecord(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + passwordDigest(password, salt);
}

function passwordMatches(password, record) {
  const [salt, expected] = String(record || "").split(":");
  if (!salt || !expected) return false;
  const actual = passwordDigest(password, salt);
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionCookie(raw, clear = false) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return "fenix_session=" + (clear ? "" : encodeURIComponent(raw)) + "; Path=/; HttpOnly; SameSite=Strict" + secure + (clear ? "; Max-Age=0" : "; Max-Age=" + sessionDays * 86400);
}

function createSession(userId) {
  const raw = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionDays * 86400_000).toISOString();
  db.prepare("INSERT INTO _fenix_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(sha256(raw), userId, expires);
  return raw;
}

const dummyPassword = passwordRecord("fenix-timing-pad");
const dummyOtpSalt = randomBytes(16).toString("hex");
const dummyOtpDigest = scryptSync("00000000", Buffer.from(dummyOtpSalt, "hex"), 32).toString("hex");
const recoverWindowMs = 15 * 60 * 1000;
const passwordlessWindowMs = 10 * 60 * 1000;

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwarded) return forwarded.slice(0, 64);
  const addr = req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : "";
  return (addr || "unknown").slice(0, 64);
}

function limited(key, max, windowMs) {
  try {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = db.prepare("SELECT count, window_start FROM _fenix_auth_limits WHERE key=?").get(key);
      if (!row) {
        db.prepare("INSERT INTO _fenix_auth_limits(key,count,window_start) VALUES (?,?,?)").run(key, 1, nowIso);
        db.exec("COMMIT");
        return false;
      }
      const start = Date.parse(row.window_start);
      if (!Number.isFinite(start) || now - start >= windowMs) {
        db.prepare("UPDATE _fenix_auth_limits SET count=1, window_start=? WHERE key=?").run(nowIso, key);
        db.exec("COMMIT");
        return false;
      }
      if (row.count >= max) {
        db.exec("COMMIT");
        return true;
      }
      db.prepare("UPDATE _fenix_auth_limits SET count=count+1 WHERE key=?").run(key);
      db.exec("COMMIT");
      return false;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  } catch {
    return true;
  }
}

function deliverMail(kind, payload) {
  db.prepare("INSERT INTO _fenix_outbox (id,kind,created_at,payload) VALUES (?,?,?,?)").run(randomUUID(), kind, new Date().toISOString(), JSON.stringify(payload));
}

function mintOtp() {
  let out = "";
  while (out.length < 8) {
    const n = randomBytes(1)[0];
    if (n > 249) continue;
    out += String(n % 10);
  }
  return out;
}

function otpDigest(otp, salt) {
  return scryptSync(String(otp || ""), Buffer.from(salt || dummyOtpSalt, "hex"), 32).toString("hex");
}

function otpMatches(otp, salt, expected) {
  const actual = Buffer.from(otpDigest(otp, salt), "hex");
  const want = Buffer.from(String(expected || dummyOtpDigest), "hex");
  return actual.length === want.length && actual.length > 0 && timingSafeEqual(actual, want);
}

function protoHost(req) {
  const host = String(req.headers.host || "").split(",")[0].trim();
  const proto = String(req.headers["x-forwarded-proto"] || (process.env.NODE_ENV === "production" ? "https" : "http")).split(",")[0].trim();
  return host ? proto + "://" + host : "";
}

function originAllowed(req) {
  const origin = String(req.headers.origin || "");
  if (!origin) return { ok: true, echo: false };
  const extra = process.env.FENIX_ALLOWED_ORIGIN || "";
  const self = protoHost(req);
  if (origin === self || (extra && origin === extra)) return { ok: true, echo: true };
  if (!extra) return { ok: true, echo: false };
  return { ok: false, echo: false };
}

async function body(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBody) throw Object.assign(new Error("Corpo troppo grande"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("JSON non valido"), { status: 400 });
  }
}

function validate(record, collection) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "Record non valido";
  const allowed = new Map(collection.fields.map((f) => [f.name, f]));
  for (const key of Object.keys(record)) if (!allowed.has(key)) return "Campo non previsto: " + key;
  for (const field of collection.fields) {
    const value = record[field.name];
    if (field.required && (value === undefined || value === null || value === "")) return "Campo obbligatorio: " + field.name;
    if (value === undefined || value === null) continue;
    if (field.type === "text" && typeof value !== "string") return "Tipo non valido: " + field.name;
    if (field.type === "integer" && (!Number.isInteger(value))) return "Tipo non valido: " + field.name;
    if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) return "Tipo non valido: " + field.name;
    if (field.type === "boolean" && typeof value !== "boolean") return "Tipo non valido: " + field.name;
    if (field.type === "json" && typeof value !== "object") return "Tipo non valido: " + field.name;
  }
  return "";
}

function row(value) {
  if (!value) return null;
  return { id: value.id, ...JSON.parse(value.data), created_at: value.created_at, updated_at: value.updated_at, version: value.version };
}

function publicFile(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(String(urlPath || "/").split("?")[0]); } catch { return null; }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const abs = resolve(root, rel);
  const base = resolve(root);
  if (abs !== base && !abs.startsWith(base + sep)) return null;
  const fromRoot = relative(base, abs).replace(/\\/g, "/");
  if (!fromRoot || fromRoot.startsWith("..")) return null;
  if (/(^|\/)(backend|node_modules)(\/|$)/i.test(fromRoot)) return null;
  if (/(^|\/)\.env(?:$|\.)/i.test(fromRoot)) return null;
  if (/\.(sqlite3?|db)$/i.test(fromRoot) || /(?:^|\/)fenix\.sqlite(?:-wal|-shm)?$/i.test(fromRoot)) return null;
  if (!existsSync(abs)) return null;
  const stat = statSync(abs);
  if (!stat.isFile()) return null;
  const type = MIME[extname(abs).toLowerCase()];
  if (!type) return null;
  return { abs, type };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://fenix.local");
    if (url.pathname === "/health" && req.method === "GET") {
      return json(res, 200, { ok: true, service: "fenix-backend", version: manifest.version, schema: schemaVersion, origin: "same" });
    }
    const gate = originAllowed(req);
    if (!gate.ok) return json(res, 403, { error: "Origine non consentita" });
    if (gate.echo) {
      res.setHeader("access-control-allow-origin", String(req.headers.origin || ""));
      res.setHeader("access-control-allow-credentials", "true");
      res.setHeader("vary", "origin");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
        "access-control-allow-headers": "authorization,content-type,if-match",
        "access-control-max-age": "600",
      });
      return res.end();
    }
    if (url.pathname === "/auth/signup" && req.method === "POST") {
      if (!allowSignup) return json(res, 403, { error: "Registrazione disattivata" });
      const input = await body(req);
      const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
      const password = typeof input.password === "string" ? input.password : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return json(res, 400, { error: "Email non valida" });
      }
      if (password.length < 12 || password.length > 128) {
        return json(res, 400, { error: "La password deve avere da 12 a 128 caratteri" });
      }
      if (db.prepare("SELECT 1 FROM _fenix_users WHERE email=?").get(email)) {
        return json(res, 409, { error: "Account già esistente" });
      }
      const userId = randomUUID();
      db.prepare("INSERT INTO _fenix_users (id,email,password_hash,created_at) VALUES (?,?,?,?)").run(userId, email, passwordRecord(password), new Date().toISOString());
      const raw = createSession(userId);
      return json(res, 201, { id: userId, email }, { "set-cookie": sessionCookie(raw) });
    }
    if (url.pathname === "/auth/login" && req.method === "POST") {
      const input = await body(req);
      const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
      const password = typeof input.password === "string" ? input.password : "";
      const user = db.prepare("SELECT id,email,password_hash FROM _fenix_users WHERE email=?").get(email);
      if (!user || !passwordMatches(password, user.password_hash)) {
        return json(res, 401, { error: "Credenziali non valide" });
      }
      db.prepare("DELETE FROM _fenix_sessions WHERE expires_at<=?").run(new Date().toISOString());
      if (hasLastLogin) db.prepare("UPDATE _fenix_users SET last_login_at=? WHERE id=?").run(new Date().toISOString(), user.id);
      const raw = createSession(user.id);
      return json(res, 200, { id: user.id, email: user.email }, { "set-cookie": sessionCookie(raw) });
    }
    if (url.pathname === "/auth/logout" && req.method === "POST") {
      const raw = cookie(req, "fenix_session");
      if (raw) db.prepare("DELETE FROM _fenix_sessions WHERE token_hash=?").run(sha256(raw));
      return json(res, 200, { ok: true }, { "set-cookie": sessionCookie("", true) });
    }
    if (url.pathname === "/auth/me" && req.method === "GET") {
      const actor = principal(req);
      return actor
        ? json(res, 200, { id: actor.id, email: actor.email, service: actor.service })
        : json(res, 401, { error: "Non autorizzato" }, { "www-authenticate": "Bearer" });
    }
    if (url.pathname === "/auth/recover" && req.method === "POST") {
      const input = await body(req);
      const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
      const ip = clientIp(req);
      if (limited("recover:ip:" + sha256(ip), 8, recoverWindowMs) || (email && limited("recover:mail:" + sha256(email), 3, recoverWindowMs))) {
        return json(res, 429, { error: "Troppi tentativi" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return json(res, 400, { error: "Email non valida" });
      }
      const user = db.prepare("SELECT id FROM _fenix_users WHERE email=?").get(email);
      if (!user || user.id === serviceId) {
        passwordMatches("fenix-timing-pad", dummyPassword);
        return json(res, 200, { ok: true });
      }
      const now = new Date();
      const raw = randomBytes(32).toString("base64url");
      const stamp = now.toISOString();
      const expires = new Date(now.getTime() + recoverWindowMs).toISOString();
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("UPDATE _fenix_password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL").run(stamp, user.id);
        db.prepare("INSERT INTO _fenix_password_resets (token_hash,user_id,expires_at,used_at,created_at) VALUES (?,?,?,NULL,?)").run(sha256(raw), user.id, expires, stamp);
        deliverMail("password_reset", { user_id: user.id, token: raw });
        db.exec("COMMIT");
      } catch (error) {
        try { db.exec("ROLLBACK"); } catch {}
        throw error;
      }
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/auth/reset" && req.method === "POST") {
      const input = await body(req);
      const ip = clientIp(req);
      if (limited("reset:ip:" + sha256(ip), 20, recoverWindowMs)) {
        return json(res, 429, { error: "Troppi tentativi" });
      }
      const rawToken = typeof input.token === "string" ? input.token.trim() : "";
      const password = typeof input.password === "string" ? input.password : "";
      if (rawToken.length < 16 || rawToken.length > 128) {
        return json(res, 400, { error: "Token non valido" });
      }
      if (password.length < 12 || password.length > 128) {
        return json(res, 400, { error: "La password deve avere da 12 a 128 caratteri" });
      }
      const now = new Date().toISOString();
      db.exec("BEGIN IMMEDIATE");
      try {
        const row = db.prepare("SELECT token_hash,user_id FROM _fenix_password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>?").get(sha256(rawToken), now);
        if (!row) {
          db.exec("ROLLBACK");
          return json(res, 400, { error: "Token non valido" });
        }
        db.prepare("UPDATE _fenix_password_resets SET used_at=? WHERE token_hash=? AND used_at IS NULL").run(now, row.token_hash);
        db.prepare("UPDATE _fenix_users SET password_hash=? WHERE id=?").run(passwordRecord(password), row.user_id);
        db.prepare("DELETE FROM _fenix_sessions WHERE user_id=?").run(row.user_id);
        db.exec("COMMIT");
      } catch (error) {
        try { db.exec("ROLLBACK"); } catch {}
        throw error;
      }
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/auth/passwordless" && req.method === "POST") {
      const input = await body(req);
      const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
      const method = typeof input.method === "string" ? input.method.trim() : "";
      const ip = clientIp(req);
      if (method !== "magic" && method !== "otp") {
        return json(res, 400, { error: "Metodo non valido" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return json(res, 400, { error: "Email non valida" });
      }
      if (limited("pwless:ip:" + sha256(ip), 12, recoverWindowMs) || limited("pwless:mail:" + sha256(email), 3, recoverWindowMs)) {
        return json(res, 429, { error: "Troppi tentativi" });
      }
      const user = db.prepare("SELECT id FROM _fenix_users WHERE email=?").get(email);
      if (!user || user.id === serviceId) {
        if (method === "otp") otpMatches("00000000", dummyOtpSalt, dummyOtpDigest);
        else passwordMatches("fenix-timing-pad", dummyPassword);
        return json(res, 200, { ok: true });
      }
      const now = new Date();
      const stamp = now.toISOString();
      const expires = new Date(now.getTime() + passwordlessWindowMs).toISOString();
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("UPDATE _fenix_passwordless SET used_at=? WHERE user_id=? AND used_at IS NULL").run(stamp, user.id);
        if (method === "magic") {
          const raw = randomBytes(32).toString("base64url");
          db.prepare("INSERT INTO _fenix_passwordless (id,token_hash,user_id,kind,salt,expires_at,used_at,attempts,created_at) VALUES (?,?,?,?,?,?,NULL,0,?)").run(randomUUID(), sha256(raw), user.id, "magic", "", expires, stamp);
          deliverMail("passwordless_magic", { user_id: user.id, token: raw });
        } else {
          const otp = mintOtp();
          const salt = randomBytes(16).toString("hex");
          db.prepare("INSERT INTO _fenix_passwordless (id,token_hash,user_id,kind,salt,expires_at,used_at,attempts,created_at) VALUES (?,?,?,?,?,?,NULL,0,?)").run(randomUUID(), otpDigest(otp, salt), user.id, "otp", salt, expires, stamp);
          deliverMail("passwordless_otp", { user_id: user.id, otp: otp });
        }
        db.exec("COMMIT");
      } catch (error) {
        try { db.exec("ROLLBACK"); } catch {}
        throw error;
      }
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/auth/passwordless/verify" && req.method === "POST") {
      const input = await body(req);
      const ip = clientIp(req);
      if (limited("pwlessv:ip:" + sha256(ip), 20, recoverWindowMs)) {
        return json(res, 429, { error: "Troppi tentativi" });
      }
      const rawToken = typeof input.token === "string" ? input.token.trim() : "";
      const otp = typeof input.otp === "string" ? input.otp.trim() : "";
      const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
      const now = new Date().toISOString();
      if (rawToken) {
        if (rawToken.length < 16 || rawToken.length > 128) {
          passwordMatches("fenix-timing-pad", dummyPassword);
          return json(res, 400, { error: "Codice non valido" });
        }
        db.exec("BEGIN IMMEDIATE");
        try {
          const row = db.prepare("SELECT p.id,p.user_id,u.email FROM _fenix_passwordless p JOIN _fenix_users u ON u.id=p.user_id WHERE p.token_hash=? AND p.kind='magic' AND p.used_at IS NULL AND p.expires_at>?").get(sha256(rawToken), now);
          if (!row) {
            passwordMatches("fenix-timing-pad", dummyPassword);
            db.exec("ROLLBACK");
            return json(res, 400, { error: "Codice non valido" });
          }
          const marked = db.prepare("UPDATE _fenix_passwordless SET used_at=? WHERE id=? AND used_at IS NULL").run(now, row.id);
          if (!marked.changes) {
            db.exec("ROLLBACK");
            return json(res, 400, { error: "Codice non valido" });
          }
          db.prepare("UPDATE _fenix_passwordless SET used_at=? WHERE user_id=? AND used_at IS NULL").run(now, row.user_id);
          if (hasLastLogin) db.prepare("UPDATE _fenix_users SET last_login_at=? WHERE id=?").run(now, row.user_id);
          const raw = createSession(row.user_id);
          db.exec("COMMIT");
          return json(res, 200, { id: row.user_id, email: row.email }, { "set-cookie": sessionCookie(raw) });
        } catch (error) {
          try { db.exec("ROLLBACK"); } catch {}
          throw error;
        }
      }
      if (!/^\d{8}$/.test(otp) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        otpMatches("00000000", dummyOtpSalt, dummyOtpDigest);
        return json(res, 400, { error: "Codice non valido" });
      }
      db.exec("BEGIN IMMEDIATE");
      try {
        const user = db.prepare("SELECT id,email FROM _fenix_users WHERE email=?").get(email);
        const row = user
          ? db.prepare("SELECT id,user_id,salt,token_hash,attempts FROM _fenix_passwordless WHERE user_id=? AND kind='otp' AND used_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1").get(user.id, now)
          : null;
        if (!user || user.id === serviceId || !row) {
          otpMatches(otp, dummyOtpSalt, dummyOtpDigest);
          db.exec("ROLLBACK");
          return json(res, 400, { error: "Codice non valido" });
        }
        if (row.attempts >= 5) {
          db.prepare("UPDATE _fenix_passwordless SET used_at=? WHERE id=?").run(now, row.id);
          db.exec("COMMIT");
          return json(res, 400, { error: "Codice non valido" });
        }
        if (!otpMatches(otp, row.salt, row.token_hash)) {
          const next = row.attempts + 1;
          if (next >= 5) db.prepare("UPDATE _fenix_passwordless SET attempts=?, used_at=? WHERE id=?").run(next, now, row.id);
          else db.prepare("UPDATE _fenix_passwordless SET attempts=? WHERE id=?").run(next, row.id);
          db.exec("COMMIT");
          return json(res, 400, { error: "Codice non valido" });
        }
        const marked = db.prepare("UPDATE _fenix_passwordless SET used_at=? WHERE id=? AND used_at IS NULL").run(now, row.id);
        if (!marked.changes) {
          db.exec("ROLLBACK");
          return json(res, 400, { error: "Codice non valido" });
        }
        db.prepare("UPDATE _fenix_passwordless SET used_at=? WHERE user_id=? AND used_at IS NULL").run(now, row.user_id);
        if (hasLastLogin) db.prepare("UPDATE _fenix_users SET last_login_at=? WHERE id=?").run(now, row.user_id);
        const raw = createSession(row.user_id);
        db.exec("COMMIT");
        return json(res, 200, { id: row.user_id, email: user.email }, { "set-cookie": sessionCookie(raw) });
      } catch (error) {
        try { db.exec("ROLLBACK"); } catch {}
        throw error;
      }
    }
    if (url.pathname.startsWith("/api/")) {
      const actor = principal(req);
      if (!actor) return json(res, 401, { error: "Non autorizzato" }, { "www-authenticate": "Bearer" });
      const match = url.pathname.match(/^\/api\/([A-Za-z][A-Za-z0-9_]{0,47})(?:\/([A-Za-z0-9-]{1,80}))?$/);
      if (!match) return json(res, 404, { error: "Rotta non trovata" });
      const collection = collections.get(match[1]);
      if (!collection) return json(res, 404, { error: "Collezione non trovata" });
      const name = collection.name;
      const id = match[2] || "";
      if (req.method === "GET" && !id) {
        const requestedLimit = Number(url.searchParams.get("limit") || 50);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 50;
        const rows = db.prepare('SELECT * FROM "' + name + '" WHERE owner_id=? ORDER BY updated_at DESC LIMIT ?').all(actor.id, limit).map(row);
        return json(res, 200, { items: rows });
      }
      if (req.method === "GET" && id) {
        const found = row(db.prepare('SELECT * FROM "' + name + '" WHERE id=? AND owner_id=?').get(id, actor.id));
        return found ? json(res, 200, found) : json(res, 404, { error: "Record non trovato" });
      }
      if (req.method === "POST" && !id) {
        const input = await body(req);
        const invalid = validate(input, collection);
        if (invalid) return json(res, 400, { error: invalid });
        const now = new Date().toISOString();
        const nextId = randomUUID();
        db.prepare('INSERT INTO "' + name + '" (id,owner_id,data,created_at,updated_at,version) VALUES (?,?,?,?,?,1)').run(nextId, actor.id, JSON.stringify(input), now, now);
        return json(res, 201, row(db.prepare('SELECT * FROM "' + name + '" WHERE id=? AND owner_id=?').get(nextId, actor.id)));
      }
      if (req.method === "PUT" && id) {
        const expected = Number(String(req.headers["if-match"] || "").replace(/^\"|\"$/g, ""));
        if (!Number.isInteger(expected) || expected < 1) return json(res, 428, { error: "If-Match richiesto" });
        const input = await body(req);
        const invalid = validate(input, collection);
        if (invalid) return json(res, 400, { error: invalid });
        const now = new Date().toISOString();
        const changed = db.prepare('UPDATE "' + name + '" SET data=?,updated_at=?,version=version+1 WHERE id=? AND owner_id=? AND version=?').run(JSON.stringify(input), now, id, actor.id, expected);
        if (!changed.changes) return json(res, 409, { error: "Conflitto di versione" });
        return json(res, 200, row(db.prepare('SELECT * FROM "' + name + '" WHERE id=? AND owner_id=?').get(id, actor.id)));
      }
      if (req.method === "DELETE" && id) {
        const expected = Number(String(req.headers["if-match"] || "").replace(/^\"|\"$/g, ""));
        if (!Number.isInteger(expected) || expected < 1) return json(res, 428, { error: "If-Match richiesto" });
        const changed = db.prepare('DELETE FROM "' + name + '" WHERE id=? AND owner_id=? AND version=?').run(id, actor.id, expected);
        return changed.changes ? json(res, 200, { ok: true }) : json(res, 409, { error: "Conflitto di versione" });
      }
      return json(res, 405, { error: "Metodo non consentito" }, { allow: "GET,POST,PUT,DELETE" });
    }
    if (req.method === "GET" || req.method === "HEAD") {
      const file = publicFile(url.pathname);
      if (file) {
        const bytes = readFileSync(file.abs);
        res.writeHead(200, { "content-type": file.type, "cache-control": "no-store", "x-content-type-options": "nosniff", "content-length": bytes.length });
        return res.end(req.method === "HEAD" ? undefined : bytes);
      }
    }
    return json(res, 404, { error: "Rotta non trovata" });
  } catch (error) {
    return json(res, Number(error?.status || 500), { error: Number(error?.status) < 500 ? error.message : "Errore interno" });
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, process.env.FENIX_HOST || "0.0.0.0", () => {
  const address = server.address();
  process.stdout.write(JSON.stringify({ ready: true, port: typeof address === "object" && address ? address.port : port, schema: schemaVersion, origin: "same" }) + "\n");
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
`;

export function materializePortableBackend(spec: PortableBackendSpec): ProjectFile[] {
  const errors = validatePortableBackendSpec(spec);
  if (errors.length) throw new Error(errors.join(" "));
  const migrations = portableBackendMigrations(spec);
  const manifest = {
    version: PORTABLE_BACKEND_VERSION,
    runtime: "node-sqlite",
    auth: "session-cookie+bearer-env",
    origin: "same",
    schemaVersion: PORTABLE_SCHEMA_VERSION,
    collections: spec.collections.map((collection) => ({
      name: collection.name,
      fields: collection.fields.map((field) => ({
        name: field.name,
        type: field.type,
        required: field.required === true,
      })),
    })),
  };
  const backendPackage = {
    name: "fenix-portable-backend",
    private: true,
    type: "module",
    engines: { node: ">=22.5" },
    scripts: { start: "node server.mjs", check: "node --check server.mjs" },
  };
  const rootPackage = {
    name: "fenix-generated-app",
    private: true,
    type: "module",
    engines: { node: ">=22.5" },
    scripts: {
      start: "node backend/server.mjs",
      check: "node --check backend/server.mjs",
    },
  };
  const deploy = {
    version: 1,
    contract: PORTABLE_BACKEND_VERSION,
    runtime: "node-sqlite",
    origin: "same",
    start: "node backend/server.mjs",
    check: "node --check backend/server.mjs",
    health: "/health",
    frontend: "/",
    api: "/api",
    migrations: "backend/migrations",
    schemaVersion: PORTABLE_SCHEMA_VERSION,
  };
  return [
    { path: PORTABLE_BACKEND_MANIFEST, content: `${JSON.stringify(manifest, null, 2)}\n` },
    { path: PORTABLE_DEPLOY_MANIFEST, content: `${JSON.stringify(deploy, null, 2)}\n` },
    { path: "package.json", content: `${JSON.stringify(rootPackage, null, 2)}\n` },
    { path: "backend/package.json", content: `${JSON.stringify(backendPackage, null, 2)}\n` },
    { path: "backend/schema.sql", content: schemaSql(spec) },
    { path: "backend/server.mjs", content: SERVER },
    {
      path: "backend/README.md",
      content:
        "# Backend Fenix portabile\n\nNode 22.5+, SQLite durevole, frontend e API sulla stessa origine. `npm start` dalla radice del progetto serve `index.html` e `/api` insieme. Migrazioni in `backend/migrations/` (forward-only, idempotenti, transazione unica). Include registrazione/login email-password, sessioni opache archiviate solo come hash in cookie HttpOnly, isolamento dei record per utente, recupero password enumeration-safe (token one-shot solo hash, TTL 15 minuti, outbox SQLite, nessuna SMTP) e accesso passwordless con magic-link e OTP email (hash-only, one-shot, TTL 10 minuti, outbox server-side). `FENIX_API_TOKEN` abilita inoltre l'accesso server-to-server; opzionali `FENIX_ALLOW_SIGNUP=false`, `FENIX_DB_PATH`, `FENIX_ALLOWED_ORIGIN`, `FENIX_PUBLIC_ROOT`, `FENIX_HOST` e `PORT`. Imposta `FENIX_ALLOWED_ORIGIN` solo se serve un'origine extra. Nessun segreto è incluso nell'archivio. Non è un database distribuito.\n",
    },
    ...migrations.map((migration) => ({
      path: `backend/migrations/${migration.filename}`,
      content: migration.sql,
    })),
  ];
}

export function hydratePortableBackendFiles(input: ProjectFile[]): {
  files: ProjectFile[];
  present: boolean;
  errors: string[];
} {
  const source = input.find((file) => file.path === PORTABLE_BACKEND_MANIFEST);
  if (!source) return { files: input, present: false, errors: [] };
  let parsed: PortableBackendSpec;
  try {
    parsed = JSON.parse(source.content) as PortableBackendSpec;
  } catch {
    return { files: input, present: true, errors: ["Manifest backend JSON non valido."] };
  }
  const errors = validatePortableBackendSpec(parsed);
  if (errors.length) return { files: input, present: true, errors };
  const generated = materializePortableBackend(parsed);
  return {
    files: [...input.filter((file) => !isGeneratedPortablePath(file.path)), ...generated],
    present: true,
    errors: [],
  };
}
