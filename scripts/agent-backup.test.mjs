import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { snapshot, list, verify, restore, prune, copyDatabase } from "../workers/agent/backup.mjs";
import { createAgentServer } from "../workers/agent/server.mjs";
import { JobStore } from "../workers/agent/jobs.mjs";
import { SiteStore } from "../workers/agent/sites.mjs";

const TOKEN = "backup-token-0123456789abcdef";
let root, dataDir, outDir, siteStore;

async function seedSite(slug, owner, rows) {
  await siteStore.publish({ slug, owner, name: slug, kind: "app", files: [{ path: "server.mjs", content: "// x" }], jobId: null });
  const dir = siteStore.dataDir(slug);
  await mkdir(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "app.db"));
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS clienti (id INTEGER PRIMARY KEY, nome TEXT)");
  const ins = db.prepare("INSERT INTO clienti (nome) VALUES (?)");
  for (const r of rows) ins.run(r);
  await writeFile(join(dir, "uploads.txt"), `upload di ${slug}`);
  return db; // left open: simulates the app still writing
}

function count(slug) {
  const db = new DatabaseSync(join(siteStore.dataDir(slug), "app.db"), { readOnly: true });
  try { return db.prepare("SELECT count(*) AS n FROM clienti").get().n; } finally { db.close(); }
}

before(async () => {
  root = await mkdtemp(join(tmpdir(), "fenix-backup-"));
  dataDir = join(root, "data");
  outDir = join(root, "backups");
  await mkdir(join(dataDir, "jobs"), { recursive: true });
  await writeFile(join(dataDir, "jobs", "job-1.json"), JSON.stringify({ id: "job-1", owner: "a".repeat(32), status: "ok" }));
  siteStore = new SiteStore({ dir: join(dataDir, "sites") });
});
after(async () => { await rm(root, { recursive: true, force: true }); });

test("snapshot copies live SQLite databases consistently, records and uploads; verify passes", async () => {
  const open = await seedSite("barbiere", "a".repeat(32), ["Anna", "Bruno"]);
  await seedSite("dentista", "b".repeat(32), ["Carla"]);
  open.prepare("INSERT INTO clienti (nome) VALUES (?)").run("Dario"); // written while "running", still in WAL
  const m = await snapshot({ dataDir, outDir, keep: 0, now: new Date("2026-09-08T10:00:00Z") });
  assert.deepEqual(m.sites, ["barbiere", "dentista"]);
  assert.equal(m.jobs, 1);
  assert.ok(m.entries.some((e) => e.path === "sites/barbiere/data/app.db" && e.kind === "sqlite"));
  assert.ok(m.entries.some((e) => e.path === "sites/barbiere/data/uploads.txt" && e.kind === "file"));
  assert.ok(!m.entries.some((e) => /-wal$|-shm$/.test(e.path)), "WAL side files are folded, not copied");
  const copy = new DatabaseSync(join(m.dir, "sites", "barbiere", "data", "app.db"), { readOnly: true });
  assert.equal(copy.prepare("SELECT count(*) AS n FROM clienti").get().n, 3, "the WAL write is in the copy");
  copy.close();
  open.close();
  const v = await verify(m.dir);
  assert.equal(v.stamp, "2026-09-08T10-00-00Z");
});

test("verify rejects a tampered snapshot", async () => {
  const [latest] = await list({ outDir });
  const p = join(latest.dir, "sites", "dentista", "data", "uploads.txt");
  await writeFile(p, "manomesso");
  await assert.rejects(() => verify(latest.dir), /Checksum diverso/);
  await writeFile(p, "upload di dentista");
  await verify(latest.dir);
});

test("restore brings a slug back after data loss and keeps the damaged copy in trash", async () => {
  const [latest] = await list({ outDir });
  // Disaster: barbiere's data directory wiped, dentista untouched but modified after the snapshot.
  await rm(siteStore.dataDir("barbiere"), { recursive: true, force: true });
  const d = new DatabaseSync(join(siteStore.dataDir("dentista"), "app.db"));
  d.prepare("INSERT INTO clienti (nome) VALUES (?)").run("Elena");
  d.close();
  const r = await restore({ snapshotDir: latest.dir, dataDir, only: ["barbiere"], now: new Date("2026-09-08T11:00:00Z") });
  assert.deepEqual(r.restored, ["barbiere"]);
  assert.equal(count("barbiere"), 3);
  assert.equal(await readFile(join(siteStore.dataDir("barbiere"), "uploads.txt"), "utf8"), "upload di barbiere");
  assert.equal(count("dentista"), 2, "slugs outside --only are untouched");
  assert.equal(r.jobs, 0, "existing job records are never overwritten");
  // Full restore moves dentista's newer data to trash rather than deleting it.
  const r2 = await restore({ snapshotDir: latest.dir, dataDir, now: new Date("2026-09-08T12:00:00Z") });
  assert.deepEqual(r2.restored, ["barbiere", "dentista"]);
  assert.equal(count("dentista"), 1);
  const trashed = new DatabaseSync(join(r2.trash, "sites", "dentista", "data", "app.db"), { readOnly: true });
  assert.equal(trashed.prepare("SELECT count(*) AS n FROM clienti").get().n, 2);
  trashed.close();
  await assert.rejects(() => restore({ snapshotDir: latest.dir, dataDir, only: ["fantasma"] }), /Slug non presente/);
});

test("prune keeps the newest N snapshots", async () => {
  for (const h of [1, 2, 3]) await snapshot({ dataDir, outDir, keep: 0, now: new Date(`2026-09-08T1${h}:30:00Z`) });
  assert.equal((await list({ outDir })).length, 4);
  const removed = await prune({ outDir, keep: 2 });
  assert.equal(removed.length, 2);
  const left = await list({ outDir });
  assert.deepEqual(left.map((s) => s.stamp), ["2026-09-08T13-30-00Z", "2026-09-08T12-30-00Z"]);
  assert.deepEqual((await readdir(outDir)).filter((n) => n.endsWith(".partial")), []);
});

test("copyDatabase refuses a non-database file instead of producing garbage", async () => {
  const bad = join(root, "not-a-db.db");
  await writeFile(bad, "ciao");
  assert.throws(() => copyDatabase(bad, join(root, "out.db")));
});

test("operator routes: token only, no owner header, 503 when not configured", async () => {
  const store = new JobStore({ concurrency: 1, dataDir });
  const server = createAgentServer({ token: TOKEN, store, dataDir, backupDir: outDir, browserChecks: false, modelFactory: () => { throw new Error("no model"); }, sandboxFactory: () => { throw new Error("no sandbox"); } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const noToken = await fetch(`${base}/agent/admin/backups`);
    assert.equal(noToken.status, 401);
    const ls = await fetch(`${base}/agent/admin/backups`, { headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(ls.status, 200);
    const body = await ls.json();
    assert.equal(body.backups.length, 2);
    const mk = await fetch(`${base}/agent/admin/backups`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(mk.status, 200);
    const made = await mk.json();
    assert.deepEqual(made.sites, ["barbiere", "dentista"]);
    assert.equal((await list({ outDir })).length, 3);
    const del = await fetch(`${base}/agent/admin/backups`, { method: "DELETE", headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(del.status, 405);
  } finally {
    store.close();
    server.close();
    await server.previews.close();
  }
  const bare = createAgentServer({ token: TOKEN, store: new JobStore({ concurrency: 1 }), browserChecks: false });
  bare.listen(0, "127.0.0.1");
  await once(bare, "listening");
  try {
    const r = await fetch(`http://127.0.0.1:${bare.address().port}/agent/admin/backups`, { headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(r.status, 503);
  } finally {
    bare.close();
    await bare.previews.close();
  }
});
