// Fenix Project contract v1 — what the agent must produce and what the checks verify.
//
// A generated project is a plain directory:
//   fenix.project.json      manifest (this file describes it)
//   package.json            { "type": "module", "scripts": { "start", "test" } } — NO dependencies
//   server.mjs              Node 22 http server: static files from public/, JSON API under /api/,
//                           SQLite through node:sqlite at $DATA_DIR/app.db, GET /health -> { ok: true }
//   public/**               index.html + other pages, app.js, styles.css, assets
//   tests/*.test.mjs        node --test files that start the server on a random port and exercise it
//
// Everything is dependency-free on purpose: the sandbox has no npm access and the
// exported project must run with `node server.mjs` on any machine with Node >= 22.13.

export const CONTRACT_VERSION = 1;
export const MANIFEST_PATH = "fenix.project.json";
export const PROJECT_KINDS = new Set(["app", "site"]);

export const LIMITS = Object.freeze({
  maxFiles: 120,
  maxFileBytes: 400_000,
  maxProjectBytes: 4_000_000,
  maxPathLength: 180,
  maxToolOutputChars: 12_000,
  maxCommandSeconds: 120,
  serverStartSeconds: 15,
});

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const FORBIDDEN_SEGMENTS = new Set([".git", "node_modules", ".env", ".fenix"]);

/**
 * Canonicalize a project-relative path or throw. Rejects traversal, absolute
 * paths, backslashes, control characters and reserved directories.
 */
export function canonicalizePath(input) {
  const raw = String(input ?? "");
  if (!raw || raw.length > LIMITS.maxPathLength) throw new Error(`Percorso non valido: ${raw.slice(0, 60)}`);
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) throw new Error("Percorso con caratteri non consentiti.");
  if (raw.startsWith("/") || /^[A-Za-z]:/.test(raw)) throw new Error("Percorso assoluto non consentito.");
  const parts = raw.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.length === 0) throw new Error("Percorso vuoto.");
  for (const part of parts) {
    if (part === "..") throw new Error("Percorso con '..' non consentito.");
    if (!SEGMENT.test(part)) throw new Error(`Segmento non valido: ${part}`);
    if (FORBIDDEN_SEGMENTS.has(part)) throw new Error(`Cartella riservata: ${part}`);
  }
  return parts.join("/");
}

export function isTextPath(path) {
  return /\.(mjs|cjs|js|ts|json|html|htm|css|svg|md|txt|csv|sql|webmanifest|xml)$/i.test(path);
}

/** Validate a manifest object; returns a list of human-readable errors (empty = ok). */
export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return ["fenix.project.json deve essere un oggetto JSON."];
  if (manifest.version !== CONTRACT_VERSION) errors.push(`version deve essere ${CONTRACT_VERSION}.`);
  if (typeof manifest.name !== "string" || !manifest.name.trim() || manifest.name.length > 80) errors.push("name mancante o troppo lungo.");
  if (!PROJECT_KINDS.has(manifest.kind)) errors.push('kind deve essere "app" o "site".');
  if (manifest.start !== "node server.mjs") errors.push('start deve essere "node server.mjs".');
  if (manifest.healthPath !== "/health") errors.push('healthPath deve essere "/health".');
  if (!Array.isArray(manifest.pages) || manifest.pages.length < 1) {
    errors.push("pages deve elencare almeno una pagina.");
  } else {
    for (const page of manifest.pages) {
      if (!page || typeof page !== "object") { errors.push("Pagina non valida."); continue; }
      if (typeof page.path !== "string" || !page.path.startsWith("/")) errors.push(`Pagina con path non valido: ${String(page?.path)}`);
      if (typeof page.title !== "string" || !page.title.trim()) errors.push(`Pagina ${String(page?.path)} senza title.`);
    }
    if (!manifest.pages.some((p) => p?.path === "/")) errors.push("Serve una pagina con path \"/\".");
  }
  if (manifest.api !== undefined && !Array.isArray(manifest.api)) errors.push("api, se presente, deve essere un array di route.");
  if (Array.isArray(manifest.api)) {
    for (const route of manifest.api) {
      if (!route || typeof route.method !== "string" || typeof route.path !== "string" || !route.path.startsWith("/api/")) {
        errors.push("Route API non valida: serve { method, path:/api/... }.");
      }
    }
  }
  return errors;
}

export function parseManifest(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    return { manifest: null, errors: ["fenix.project.json non è JSON valido."] };
  }
  return { manifest, errors: validateManifest(manifest) };
}

/** Sum bytes and enforce project-level limits over a { path -> bytes } map. */
export function checkProjectSize(sizes) {
  const errors = [];
  let total = 0;
  let count = 0;
  for (const [path, bytes] of Object.entries(sizes)) {
    count += 1;
    total += bytes;
    if (bytes > LIMITS.maxFileBytes) errors.push(`${path} supera ${LIMITS.maxFileBytes} byte.`);
  }
  if (count > LIMITS.maxFiles) errors.push(`Troppi file (${count} > ${LIMITS.maxFiles}).`);
  if (total > LIMITS.maxProjectBytes) errors.push(`Progetto troppo grande (${total} byte).`);
  return { errors, total, count };
}
