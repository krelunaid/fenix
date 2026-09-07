import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentServer } from "../workers/agent/server.mjs";
import { JobStore } from "../workers/agent/jobs.mjs";
import { SiteStore, SitePool, slugify, validSlug } from "../workers/agent/sites.mjs";
import { FakeModel } from "../workers/agent/model/fake.mjs";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";

const TOKEN = "sites-token-0123456789abcdef";
const OWNER_A = "a".repeat(32);
const OWNER_B = "b".repeat(32);
const writeAll = GOLDEN_FILES.map((f) => ({ tool: "write_file", input: { path: f.path, content: f.content } }));

let dataDir, store, siteStore, sitePool, server, base;
const sandboxFactory = (opts) => LocalSandbox.create({ ...opts, jobId: `sites-${opts.jobId}` });

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "fenix-agent-data-"));
  store = new JobStore({ concurrency: 1, maxQueued: 10, dataDir });
  siteStore = new SiteStore({ dir: join(dataDir, "sites") });
  sitePool = new SitePool({ store: siteStore, sandboxFactory, idleMs: 60_000, max: 2 });
  server = createAgentServer({
    token: TOKEN, store, dataDir, sites: sitePool, browserChecks: false,
    modelFactory: () => new FakeModel([writeAll, [{ tool: "run_checks" }], [{ tool: "finish", input: { summary: "ok" } }]]),
    sandboxFactory,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await sitePool.close(); await server.previews.close(); store.close(); server.close(); await rm(dataDir, { recursive: true, force: true }); });

const call = (path, { method = "GET", body, owner = OWNER_A, headers = {} } = {}) =>
  fetch(base + path, { method, headers: { authorization: `Bearer ${TOKEN}`, "x-fenix-owner": owner, "content-type": "application/json", ...headers }, body: body && typeof body !== "string" ? JSON.stringify(body) : body });

async function buildOk(owner = OWNER_A) {
  const created = await (await call("/agent/build", { method: "POST", body: { brief: "agenda per barbiere Rossi", name: "Barbiere Rossi" }, owner })).json();
  for (let i = 0; i < 600; i++) {
    const job = await (await call(`/agent/jobs/${created.id}`, { owner })).json();
    if (job.status === "ok") return created.id;
    if (!["queued", "running"].includes(job.status)) throw new Error(`job ${job.status}: ${job.error}`);
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("timeout");
}

test("slugs", () => {
  assert.equal(slugify("Barbiere Rossi · Bari!"), "barbiere-rossi-bari");
  assert.equal(slugify("Pizzeria Da Gianni"), "pizzeria-da-gianni");
  assert.ok(validSlug("barbiere-rossi"));
  assert.ok(!validSlug("api"));
  assert.ok(!validSlug("-bad"));
  assert.ok(!validSlug("UPPER"));
});

test("finished jobs survive on disk and are readable after the in-memory store forgets them", { timeout: 180_000 }, async () => {
  const id = await buildOk();
  await new Promise((r) => setTimeout(r, 200));
  const files = await readdir(join(dataDir, "jobs"));
  assert.ok(files.includes(`${id}.json`));
  store.jobs.delete(id); // simulate a restart
  const again = await (await call(`/agent/jobs/${id}?full=1`)).json();
  assert.equal(again.status, "ok");
  assert.ok(again.result.files.some((f) => f.path === "server.mjs" && f.content));
  assert.equal((await call(`/agent/jobs/${id}`, { owner: OWNER_B })).status, 404);
});

test("publish, serve on demand with persistent data, update version, list, owner isolation, delete", { timeout: 240_000 }, async () => {
  const id = await buildOk();
  const pub = await call("/agent/sites", { method: "POST", body: { jobId: id } });
  const rec = await pub.json();
  assert.equal(pub.status, 200, JSON.stringify(rec));
  assert.equal(rec.slug, "barbiere-rossi");
  assert.equal(rec.version, 1);

  // Public relay: cold start on first request.
  const home = await call(`/agent/sites/${rec.slug}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Agenda di oggi/);
  const created = await call(`/agent/sites/${rec.slug}/api/appuntamenti`, { method: "POST", body: { cliente: "Luca Neri", servizio: "Barba", quando: "2026-09-12T11:00" } });
  assert.equal(created.status, 201);

  // Stop the app process: data must survive because it lives on the host.
  await sitePool.stop(rec.slug);
  assert.equal(sitePool.view(rec.slug).live, false);
  const list = await (await call(`/agent/sites/${rec.slug}/api/appuntamenti`)).json();
  assert.equal(list.length, 1, "data persisted across restarts");
  assert.equal(list[0].cliente, "Luca Neri");

  // Update with a new job under the same slug: version bumps, data kept.
  const id2 = await buildOk();
  const upd = await (await call("/agent/sites", { method: "POST", body: { jobId: id2, slug: rec.slug } })).json();
  assert.equal(upd.version, 2);
  const after2 = await (await call(`/agent/sites/${rec.slug}/api/appuntamenti`)).json();
  assert.equal(after2.length, 1);

  // Another owner cannot take or manage the slug.
  const idB = await buildOk(OWNER_B);
  const steal = await call("/agent/sites", { method: "POST", body: { jobId: idB, slug: rec.slug }, owner: OWNER_B });
  assert.equal(steal.status, 409);
  assert.equal((await call(`/agent/sites/${rec.slug}`, { owner: OWNER_B })).status, 404);
  assert.equal((await call(`/agent/sites/${rec.slug}`, { method: "DELETE", owner: OWNER_B })).status, 404);

  const mine = await (await call("/agent/sites")).json();
  assert.equal(mine.sites.length, 1);
  assert.equal(mine.sites[0].slug, rec.slug);
  const detail = await (await call(`/agent/sites/${rec.slug}`)).json();
  assert.equal(detail.hosting.live, true);

  assert.equal((await call("/agent/sites", { method: "POST", body: { jobId: id, slug: "api" } })).status, 400);
  assert.equal((await call(`/agent/sites/${rec.slug}`, { method: "DELETE" })).status, 200);
  assert.equal((await call(`/agent/sites/${rec.slug}/`)).status, 404);
});
