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

export const PORTABLE_BACKEND_MANIFEST = "backend/fenix.backend.json";
const GENERATED_BACKEND_PATHS = new Set([
  PORTABLE_BACKEND_MANIFEST,
  "backend/package.json",
  "backend/schema.sql",
  "backend/server.mjs",
  "backend/README.md",
]);

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,47}$/;
const RESERVED = new Set(["id", "created_at", "updated_at", "version"]);
const FIELD_TYPES = new Set<PortableFieldType>(["text", "integer", "number", "boolean", "json"]);

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

function schemaSql(spec: PortableBackendSpec): string {
  return `CREATE TABLE IF NOT EXISTS _fenix_users (
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

${spec.collections
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
    .join("\n\n")}\n`;
}

const SERVER = String.raw`import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, "fenix.backend.json"), "utf8"));
const schema = readFileSync(join(here, "schema.sql"), "utf8");
const db = new DatabaseSync(process.env.FENIX_DB_PATH || join(here, "fenix.sqlite"));
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
db.exec(schema);
const collections = new Map(manifest.collections.map((c) => [c.name, c]));
const maxBody = 256 * 1024;
const token = process.env.FENIX_API_TOKEN || "";
const allowSignup = process.env.FENIX_ALLOW_SIGNUP !== "false";
const sessionDays = 7;
const serviceId = "00000000-0000-4000-8000-000000000000";
db.prepare("INSERT OR IGNORE INTO _fenix_users (id,email,password_hash,created_at) VALUES (?,?,?,?)").run(serviceId, "service@fenix.local", "service-only", new Date(0).toISOString());

function json(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://fenix.local");
    if (url.pathname === "/health" && req.method === "GET") return json(res, 200, { ok: true, service: "fenix-backend", version: manifest.version });
    const origin = String(req.headers.origin || "");
    const allowedOrigin = process.env.FENIX_ALLOWED_ORIGIN || "";
    if (origin && allowedOrigin && origin !== allowedOrigin) return json(res, 403, { error: "Origine non consentita" });
    if (origin && allowedOrigin === origin) {
      res.setHeader("access-control-allow-origin", allowedOrigin);
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
  } catch (error) {
    return json(res, Number(error?.status || 500), { error: Number(error?.status) < 500 ? error.message : "Errore interno" });
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, process.env.FENIX_HOST || "0.0.0.0", () => {
  const address = server.address();
  process.stdout.write(JSON.stringify({ ready: true, port: typeof address === "object" && address ? address.port : port }) + "\n");
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
`;

export function materializePortableBackend(spec: PortableBackendSpec): ProjectFile[] {
  const errors = validatePortableBackendSpec(spec);
  if (errors.length) throw new Error(errors.join(" "));
  const manifest = {
    version: 2,
    runtime: "node-sqlite",
    auth: "session-cookie+bearer-env",
    collections: spec.collections.map((collection) => ({
      name: collection.name,
      fields: collection.fields.map((field) => ({
        name: field.name,
        type: field.type,
        required: field.required === true,
      })),
    })),
  };
  return [
    {
      path: "backend/fenix.backend.json",
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      path: "backend/package.json",
      content: `${JSON.stringify(
        {
          name: "fenix-portable-backend",
          private: true,
          type: "module",
          engines: { node: ">=22.5" },
          scripts: { start: "node server.mjs", check: "node --check server.mjs" },
        },
        null,
        2,
      )}\n`,
    },
    { path: "backend/schema.sql", content: schemaSql(spec) },
    { path: "backend/server.mjs", content: SERVER },
    {
      path: "backend/README.md",
      content:
        "# Backend Fenix portabile\n\nNode 22.5+, SQLite durevole, CRUD JSON e CAS con `If-Match`. Include registrazione/login email-password, sessioni opache archiviate solo come hash in cookie HttpOnly e isolamento dei record per utente. `FENIX_API_TOKEN` abilita inoltre l'accesso server-to-server; opzionali `FENIX_ALLOW_SIGNUP=false`, `FENIX_DB_PATH`, `FENIX_ALLOWED_ORIGIN`, `FENIX_HOST` e `PORT`. Imposta `FENIX_ALLOWED_ORIGIN` quando frontend e API hanno origini distinte. Nessun segreto è incluso nell'archivio.\n",
    },
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
    files: [...input.filter((file) => !GENERATED_BACKEND_PATHS.has(file.path)), ...generated],
    present: true,
    errors: [],
  };
}
