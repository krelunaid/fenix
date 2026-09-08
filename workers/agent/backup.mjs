// Backup and restore of AGENT_DATA_DIR (published apps, their SQLite data, finished jobs).
//
// A snapshot is a directory <outDir>/<stamp>/ with a manifest.json, the site records,
// the job records and every app database copied with SQLite's `VACUUM INTO`, which
// gives a consistent copy even while the app container is writing. Other files in a
// site's data dir (uploads) are copied as they are. Nothing here needs npm.
//
//   node workers/agent/backup.mjs snapshot [--data DIR] [--out DIR] [--keep N]
//   node workers/agent/backup.mjs list     [--out DIR]
//   node workers/agent/backup.mjs restore <snapshot-dir> [--data DIR] [--only slug,slug]
//   node workers/agent/backup.mjs verify   <snapshot-dir>
//
// Restore is meant to run with the agent stopped (systemctl stop fenix-agent): it
// replaces the site record and data directory per slug, never deletes slugs that are
// not in the snapshot, and refuses a snapshot whose manifest does not match its files.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile, copyFile, rm, rename, stat, lstat } from "node:fs/promises";
import { join, relative, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

export const BACKUP_VERSION = 1;
const STAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;

export function stampNow(d = new Date()) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function sha256(p) {
  return createHash("sha256").update(await readFile(p)).digest("hex");
}

/** Recursively list regular files under dir (relative paths), skipping symlinks. */
async function walk(dir, base = dir) {
  let names = [];
  try { names = await readdir(dir); } catch { return []; }
  const out = [];
  for (const n of names.sort()) {
    const p = join(dir, n);
    const st = await lstat(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...(await walk(p, base)));
    else if (st.isFile()) out.push(relative(base, p).split(sep).join("/"));
  }
  return out;
}

function isSqlite(name) {
  return /\.(db|sqlite|sqlite3)$/i.test(name);
}

/** Consistent copy of a SQLite database that may be in use by another process. */
export function copyDatabase(src, dest) {
  const db = new DatabaseSync(src, { readOnly: true });
  try {
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
}

/**
 * Takes a snapshot of dataDir into outDir/<stamp>. Returns the manifest.
 * `keep` prunes older snapshots (0 = keep all).
 */
export async function snapshot({ dataDir, outDir, keep = 14, now = new Date() } = {}) {
  if (!dataDir || !(await exists(dataDir))) throw new Error(`AGENT_DATA_DIR non trovato: ${dataDir}`);
  if (!outDir) throw new Error("Cartella di destinazione mancante (--out / AGENT_BACKUP_DIR).");
  const stamp = stampNow(now);
  const dest = join(outDir, stamp);
  const tmp = `${dest}.partial`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });

  const entries = [];
  const add = async (rel, kind) => {
    const p = join(tmp, rel);
    const st = await stat(p);
    entries.push({ path: rel, bytes: st.size, sha256: await sha256(p), kind });
  };

  // Site records + data.
  const sitesDir = join(dataDir, "sites");
  const slugs = [];
  for (const n of (await exists(sitesDir)) ? (await readdir(sitesDir)).sort() : []) {
    if (!n.endsWith(".json")) continue;
    const slug = n.slice(0, -5);
    let rec;
    try { rec = JSON.parse(await readFile(join(sitesDir, n), "utf8")); } catch { continue; }
    if (!rec || rec.slug !== slug) continue;
    slugs.push(slug);
    await mkdir(join(tmp, "sites"), { recursive: true });
    await copyFile(join(sitesDir, n), join(tmp, "sites", n));
    await add(`sites/${n}`, "site-record");
    const dataRoot = join(sitesDir, slug, "data");
    for (const rel of await walk(dataRoot)) {
      const src = join(dataRoot, rel);
      const out = join(tmp, "sites", slug, "data", rel);
      await mkdir(dirname(out), { recursive: true });
      if (isSqlite(rel)) {
        if (/-(wal|shm|journal)$/i.test(rel)) continue;
        copyDatabase(src, out);
        await add(`sites/${slug}/data/${rel}`, "sqlite");
      } else if (/\.db-(wal|shm|journal)$/i.test(rel)) {
        continue; // folded into the VACUUM copy
      } else {
        await copyFile(src, out);
        await add(`sites/${slug}/data/${rel}`, "file");
      }
    }
  }

  // Finished jobs (small JSON records; they carry the generated files).
  const jobsDir = join(dataDir, "jobs");
  let jobs = 0;
  for (const n of (await exists(jobsDir)) ? (await readdir(jobsDir)).sort() : []) {
    if (!n.endsWith(".json")) continue;
    await mkdir(join(tmp, "jobs"), { recursive: true });
    await copyFile(join(jobsDir, n), join(tmp, "jobs", n));
    await add(`jobs/${n}`, "job-record");
    jobs += 1;
  }

  const manifest = {
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    stamp,
    dataDir: resolve(dataDir),
    sites: slugs,
    jobs,
    files: entries.length,
    bytes: entries.reduce((n, e) => n + e.bytes, 0),
    entries,
  };
  await writeFile(join(tmp, "manifest.json"), JSON.stringify(manifest, null, 2));
  await rename(tmp, dest);

  const pruned = keep > 0 ? await prune({ outDir, keep }) : [];
  return { ...manifest, dir: dest, pruned };
}

/** Lists snapshots in outDir, newest first, with their manifests. */
export async function list({ outDir }) {
  let names = [];
  try { names = await readdir(outDir); } catch { return []; }
  const out = [];
  for (const n of names.filter((x) => STAMP_RE.test(x)).sort().reverse()) {
    try {
      const m = JSON.parse(await readFile(join(outDir, n, "manifest.json"), "utf8"));
      out.push({ stamp: n, dir: join(outDir, n), createdAt: m.createdAt, sites: m.sites.length, jobs: m.jobs, bytes: m.bytes });
    } catch {
      out.push({ stamp: n, dir: join(outDir, n), corrupt: true });
    }
  }
  return out;
}

export async function prune({ outDir, keep }) {
  const all = (await list({ outDir })).filter((s) => !s.corrupt);
  const doomed = all.slice(keep);
  for (const s of doomed) await rm(s.dir, { recursive: true, force: true });
  return doomed.map((s) => s.stamp);
}

/** Checks every file in a snapshot against its manifest. Throws on the first mismatch. */
export async function verify(snapshotDir) {
  const manifest = JSON.parse(await readFile(join(snapshotDir, "manifest.json"), "utf8"));
  if (manifest.version !== BACKUP_VERSION) throw new Error(`Versione backup non supportata: ${manifest.version}`);
  for (const e of manifest.entries) {
    const p = join(snapshotDir, e.path);
    if (!(await exists(p))) throw new Error(`File mancante nello snapshot: ${e.path}`);
    if ((await sha256(p)) !== e.sha256) throw new Error(`Checksum diverso: ${e.path}`);
    if (e.kind === "sqlite") {
      const db = new DatabaseSync(p, { readOnly: true });
      try {
        const r = db.prepare("PRAGMA integrity_check").get();
        if (String(r.integrity_check) !== "ok") throw new Error(`Database corrotto: ${e.path}`);
      } finally { db.close(); }
    }
  }
  return manifest;
}

/**
 * Restores sites (and jobs) from a snapshot into dataDir. Existing data for a
 * restored slug is moved to <dataDir>/.restore-trash/<stamp>/ instead of deleted.
 * Run with the agent stopped.
 */
export async function restore({ snapshotDir, dataDir, only = null, includeJobs = true, now = new Date() } = {}) {
  if (!dataDir) throw new Error("AGENT_DATA_DIR mancante.");
  const manifest = await verify(snapshotDir);
  const wanted = only ? new Set(only) : null;
  if (wanted) for (const s of wanted) if (!manifest.sites.includes(s)) throw new Error(`Slug non presente nello snapshot: ${s}`);
  const trash = join(dataDir, ".restore-trash", stampNow(now));
  const restored = [];
  await mkdir(join(dataDir, "sites"), { recursive: true });
  for (const slug of manifest.sites) {
    if (wanted && !wanted.has(slug)) continue;
    const recDst = join(dataDir, "sites", `${slug}.json`);
    const dirDst = join(dataDir, "sites", slug);
    if ((await exists(recDst)) || (await exists(dirDst))) {
      await mkdir(join(trash, "sites"), { recursive: true });
      if (await exists(recDst)) await rename(recDst, join(trash, "sites", `${slug}.json`));
      if (await exists(dirDst)) await rename(dirDst, join(trash, "sites", slug));
    }
    for (const e of manifest.entries) {
      if (!e.path.startsWith(`sites/${slug}.json`) && !e.path.startsWith(`sites/${slug}/`)) continue;
      const out = join(dataDir, e.path);
      await mkdir(dirname(out), { recursive: true });
      await copyFile(join(snapshotDir, e.path), out);
    }
    restored.push(slug);
  }
  let jobs = 0;
  if (includeJobs) {
    await mkdir(join(dataDir, "jobs"), { recursive: true });
    for (const e of manifest.entries) {
      if (e.kind !== "job-record") continue;
      const out = join(dataDir, e.path);
      if (await exists(out)) continue; // never overwrite a newer job record
      await copyFile(join(snapshotDir, e.path), out);
      jobs += 1;
    }
  }
  return { restored, jobs, trash: restored.length ? trash : null, snapshot: manifest.stamp };
}

// ---- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) { out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true"; }
    else out._.push(a);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, target] = args._;
  const dataDir = args.data || process.env.AGENT_DATA_DIR;
  const outDir = args.out || process.env.AGENT_BACKUP_DIR || (dataDir ? join(dataDir, "..", "fenix-agent-backups") : null);
  const keep = Number(args.keep || process.env.AGENT_BACKUP_KEEP || 14);
  if (cmd === "snapshot") {
    const m = await snapshot({ dataDir, outDir, keep });
    console.log(`[backup] ${m.dir}: ${m.sites.length} app, ${m.jobs} job, ${m.files} file, ${(m.bytes / 1024).toFixed(0)} KB${m.pruned.length ? `; rimossi ${m.pruned.length} vecchi` : ""}`);
    return;
  }
  if (cmd === "list") {
    for (const s of await list({ outDir })) console.log(s.corrupt ? `${s.stamp}  (corrotto)` : `${s.stamp}  app=${s.sites} job=${s.jobs} ${(s.bytes / 1024).toFixed(0)} KB`);
    return;
  }
  if (cmd === "verify") {
    const m = await verify(target);
    console.log(`[backup] ok: ${m.sites.length} app, ${m.files} file verificati`);
    return;
  }
  if (cmd === "restore") {
    if (!target) throw new Error("Indica la cartella dello snapshot.");
    const r = await restore({ snapshotDir: target, dataDir, only: args.only ? String(args.only).split(",").filter(Boolean) : null });
    console.log(`[backup] ripristinate ${r.restored.length} app (${r.restored.join(", ") || "-"}), ${r.jobs} job; dati precedenti in ${r.trash || "-"}`);
    return;
  }
  console.error("uso: backup.mjs snapshot|list|verify <dir>|restore <dir> [--data DIR] [--out DIR] [--keep N] [--only slug,slug]");
  process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`[backup] errore: ${err.message}`); process.exit(1); });
}
