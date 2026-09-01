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
  return `${spec.collections
    .map(
      (collection) => `CREATE TABLE IF NOT EXISTS "${collection.name}" (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);`,
    )
    .join("\n\n")}\n`;
}

const SERVER = String.raw`import { createServer } from "node:http";
import { timingSafeEqual, randomUUID } from "node:crypto";
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
if (process.env.NODE_ENV === "production" && !token) {
  throw new Error("FENIX_API_TOKEN obbligatorio in produzione");
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!token) return true;
  const raw = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(raw);
  const b = Buffer.from(token);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
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
    if (!authorized(req)) return json(res, 401, { error: "Non autorizzato" }, { "www-authenticate": "Bearer" });
    const match = url.pathname.match(/^\/api\/([A-Za-z][A-Za-z0-9_]{0,47})(?:\/([A-Za-z0-9-]{1,80}))?$/);
    if (!match) return json(res, 404, { error: "Rotta non trovata" });
    const collection = collections.get(match[1]);
    if (!collection) return json(res, 404, { error: "Collezione non trovata" });
    const name = collection.name;
    const id = match[2] || "";
    if (req.method === "GET" && !id) {
      const requestedLimit = Number(url.searchParams.get("limit") || 50);
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 50;
      const rows = db.prepare('SELECT * FROM "' + name + '" ORDER BY updated_at DESC LIMIT ?').all(limit).map(row);
      return json(res, 200, { items: rows });
    }
    if (req.method === "GET" && id) {
      const found = row(db.prepare('SELECT * FROM "' + name + '" WHERE id = ?').get(id));
      return found ? json(res, 200, found) : json(res, 404, { error: "Record non trovato" });
    }
    if (req.method === "POST" && !id) {
      const input = await body(req);
      const invalid = validate(input, collection);
      if (invalid) return json(res, 400, { error: invalid });
      const now = new Date().toISOString();
      const nextId = randomUUID();
      db.prepare('INSERT INTO "' + name + '" (id,data,created_at,updated_at,version) VALUES (?,?,?,?,1)').run(nextId, JSON.stringify(input), now, now);
      return json(res, 201, row(db.prepare('SELECT * FROM "' + name + '" WHERE id = ?').get(nextId)));
    }
    if (req.method === "PUT" && id) {
      const expected = Number(String(req.headers["if-match"] || "").replace(/^\"|\"$/g, ""));
      if (!Number.isInteger(expected) || expected < 1) return json(res, 428, { error: "If-Match richiesto" });
      const input = await body(req);
      const invalid = validate(input, collection);
      if (invalid) return json(res, 400, { error: invalid });
      const now = new Date().toISOString();
      const changed = db.prepare('UPDATE "' + name + '" SET data=?,updated_at=?,version=version+1 WHERE id=? AND version=?').run(JSON.stringify(input), now, id, expected);
      if (!changed.changes) return json(res, 409, { error: "Conflitto di versione" });
      return json(res, 200, row(db.prepare('SELECT * FROM "' + name + '" WHERE id = ?').get(id)));
    }
    if (req.method === "DELETE" && id) {
      const expected = Number(String(req.headers["if-match"] || "").replace(/^\"|\"$/g, ""));
      if (!Number.isInteger(expected) || expected < 1) return json(res, 428, { error: "If-Match richiesto" });
      const changed = db.prepare('DELETE FROM "' + name + '" WHERE id=? AND version=?').run(id, expected);
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
    version: 1,
    runtime: "node-sqlite",
    auth: "bearer-env",
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
        "# Backend Fenix portabile\n\nNode 22.5+, SQLite durevole, CRUD JSON e CAS con `If-Match`. In produzione imposta `FENIX_API_TOKEN`; opzionali `FENIX_DB_PATH`, `FENIX_ALLOWED_ORIGIN`, `FENIX_HOST` e `PORT`. Il token resta server-side: il login degli utenti finali non è incluso. Nessun segreto è incluso nell'archivio.\n",
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
