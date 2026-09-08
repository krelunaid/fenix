import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAgentServer } from "../workers/agent/server.mjs";
import { JobStore } from "../workers/agent/jobs.mjs";
import { PreviewPool } from "../workers/agent/preview.mjs";
import { FakeModel } from "../workers/agent/model/fake.mjs";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";

const TOKEN = "preview-token-0123456789abcdef";
const OWNER_A = "a".repeat(32);
const OWNER_B = "b".repeat(32);
const writeAll = GOLDEN_FILES.map((f) => ({ tool: "write_file", input: { path: f.path, content: f.content } }));

const sandboxFactory = ({ jobId }) => LocalSandbox.create({ jobId: `pv-${jobId}` });
const store = new JobStore({ concurrency: 1, maxQueued: 10 });
const pool = new PreviewPool({ sandboxFactory, ttlMs: 60_000, max: 2 });
const server = createAgentServer({
  token: TOKEN,
  store,
  previews: pool,
  browserChecks: false,
  modelFactory: () => new FakeModel([writeAll, [{ tool: "run_checks" }], [{ tool: "finish", input: { summary: "ok" } }]]),
  sandboxFactory,
});
let base;
before(async () => { server.listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await pool.close(); store.close(); server.close(); });

const call = (path, { method = "GET", body, owner = OWNER_A, headers = {} } = {}) =>
  fetch(base + path, { method, headers: { authorization: `Bearer ${TOKEN}`, "x-fenix-owner": owner, ...headers }, body });

async function buildOk() {
  const created = await (await call("/agent/build", { method: "POST", body: JSON.stringify({ brief: "agenda per barbiere" }), headers: { "content-type": "application/json" } })).json();
  for (let i = 0; i < 600; i++) {
    const job = await (await call(`/agent/jobs/${created.id}`)).json();
    if (job.status === "ok") return created.id;
    if (job.status !== "queued" && job.status !== "running") throw new Error(`job ${job.status}: ${job.error}`);
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("timeout");
}

test("preview serves the finished project through the relay: pages, API, persistence", { timeout: 180_000 }, async () => {
  const id = await buildOk();
  assert.equal((await call(`/agent/jobs/${id}/preview/`)).status, 409, "not started yet");
  assert.equal((await call(`/agent/jobs/${id}/preview`, { method: "POST", owner: OWNER_B })).status, 404, "other owner");
  const started = await call(`/agent/jobs/${id}/preview`, { method: "POST" });
  const startedBody = await started.json();
  assert.equal(started.status, 200, JSON.stringify(startedBody));
  assert.equal(startedBody.live, true);

  const home = await call(`/agent/jobs/${id}/preview/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /text\/html/);
  assert.match(await home.text(), /Agenda di oggi/);
  assert.equal((await call(`/agent/jobs/${id}/preview/styles.css`)).headers.get("content-type"), "text/css; charset=utf-8");
  assert.equal((await call(`/agent/jobs/${id}/preview/non-esiste`)).status, 404);

  const empty = await (await call(`/agent/jobs/${id}/preview/api/appuntamenti`)).json();
  assert.deepEqual(empty, []);
  const created = await call(`/agent/jobs/${id}/preview/api/appuntamenti`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cliente: "Mario Bianchi", servizio: "Taglio", quando: "2026-09-10T10:30" }),
  });
  assert.equal(created.status, 201);
  const list = await (await call(`/agent/jobs/${id}/preview/api/appuntamenti`)).json();
  assert.equal(list.length, 1, "data persists within the preview");

  const view = await (await call(`/agent/jobs/${id}/preview`)).json();
  assert.equal(view.live, true);
  assert.ok(view.expiresAt > Date.now());
  assert.equal((await (await call(`/agent/jobs/${id}/preview`, { method: "DELETE" })).json()).stopped, true);
  assert.equal((await call(`/agent/jobs/${id}/preview/`)).status, 409);
});

test("pool cap evicts the oldest preview; cancelling a job stops its preview", { timeout: 240_000 }, async () => {
  const a = await buildOk();
  const b = await buildOk();
  const c = await buildOk();
  assert.equal((await call(`/agent/jobs/${a}/preview`, { method: "POST" })).status, 200);
  assert.equal((await call(`/agent/jobs/${b}/preview`, { method: "POST" })).status, 200);
  assert.equal((await call(`/agent/jobs/${c}/preview`, { method: "POST" })).status, 200);
  assert.equal(pool.live.size, 2);
  assert.equal((await (await call(`/agent/jobs/${a}/preview`)).json()).live, false, "oldest evicted");
  assert.equal((await call(`/agent/jobs/${c}/preview/`)).status, 200);
  await call(`/agent/jobs/${c}`, { method: "DELETE" });
  assert.equal((await (await call(`/agent/jobs/${c}/preview`)).json()).live, false);
});

test("a broken project cannot be previewed and leaves no sandbox behind", { timeout: 60_000 }, async () => {
  const p = new PreviewPool({ sandboxFactory, ttlMs: 5_000, max: 1 });
  await assert.rejects(
    p.start({ jobId: "broken", owner: OWNER_A, files: [{ path: "server.mjs", content: "throw new Error('boom')" }] }),
    /Anteprima non avviata/,
  );
  assert.equal(p.live.size, 0);
  await p.close();
});
