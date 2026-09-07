import { test, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAgentServer } from "../workers/agent/server.mjs";
import { JobStore } from "../workers/agent/jobs.mjs";
import { FakeModel } from "../workers/agent/model/fake.mjs";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";

const TOKEN = "test-token-0123456789abcdef";
const OWNER_A = "a".repeat(32);
const OWNER_B = "b".repeat(32);
const writeAll = GOLDEN_FILES.map((f) => ({ tool: "write_file", input: { path: f.path, content: f.content } }));

const store = new JobStore({ concurrency: 1, maxQueued: 2 });
const server = createAgentServer({
  token: TOKEN,
  origin: "https://fenix.example",
  store,
  browserChecks: false,
  modelFactory: () => new FakeModel([writeAll, [{ tool: "run_checks" }], [{ tool: "finish", input: { summary: "ok" } }]]),
  sandboxFactory: ({ jobId }) => LocalSandbox.create({ jobId: `srv-${jobId}` }),
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
after(() => { store.close(); server.close(); });

const call = (path, { method = "GET", body, token = TOKEN, owner = OWNER_A } = {}) =>
  fetch(base + path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "x-fenix-owner": owner, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

test("health is public, everything else needs the token", async () => {
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await call("/agent/build", { method: "POST", body: { brief: "x" }, token: null })).status, 401);
  assert.equal((await call("/agent/build", { method: "POST", body: { brief: "x" }, token: "wrong-token-0123456789" })).status, 401);
  assert.equal((await call("/agent/jobs/abc", { token: null })).status, 401);
  const pre = await fetch(`${base}/agent/build`, { method: "OPTIONS", headers: { origin: "https://fenix.example" } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "https://fenix.example");
});

test("input validation", async () => {
  assert.equal((await call("/agent/build", { method:"POST", body:{brief:"valid brief"},owner:"" })).status,400);
  assert.equal((await call("/agent/build", { method: "POST", body: { brief: "ab" } })).status, 400);
  assert.equal((await call("/agent/build", { method: "POST", body: { instruction: "cambia colore" } })).status, 400);
  assert.equal((await call("/agent/build", { method: "POST", body: { brief: "ok brief", files: [{ path: "../x", content: "" }] } })).status, 400);
});

test("a build runs to completion; jobs are owner-bound; full view returns files", { timeout: 180_000 }, async () => {
  const created = await call("/agent/build", { method: "POST", body: { brief: "agenda per barbiere", kind: "app" } });
  assert.equal(created.status, 202);
  const { id } = await created.json();
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal((await call(`/agent/jobs/${id}`, { owner: OWNER_B })).status, 404, "un altro owner non vede il job");
  let job;
  for (let i = 0; i < 600; i++) {
    job = await (await call(`/agent/jobs/${id}`)).json();
    if (job.status !== "queued" && job.status !== "running") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(job.status, "ok", JSON.stringify(job.result?.checks?.failed || job.error));
  assert.ok(job.result.checks.ok);
  assert.ok(job.result.files.every((f) => f.content === undefined), "vista breve senza contenuti");
  const full = await (await call(`/agent/jobs/${id}?full=1`)).json();
  assert.ok(full.result.files.some((f) => f.path === "server.mjs" && f.content.includes("node:sqlite")));
  assert.ok(full.events.some((e) => e.type === "end"));
});

test("queue cap and cancellation", { timeout: 60_000 }, async () => {
  const slowStore = new JobStore({ concurrency: 1, maxQueued: 1 });
  const slow = createAgentServer({
    token: TOKEN,
    store: slowStore,
    browserChecks: false,
    modelFactory: () => ({ model: "fake", complete: () => new Promise(() => {}) }), // never resolves
    sandboxFactory: ({ jobId }) => LocalSandbox.create({ jobId: `slow-${jobId}` }),
  });
  slow.listen(0, "127.0.0.1");
  await once(slow, "listening");
  const b = `http://127.0.0.1:${slow.address().port}`;
  const post = () => fetch(`${b}/agent/build`, { method: "POST", headers: { "x-fenix-owner": OWNER_A, authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ brief: "lento lento" }) });
  try {
    const first = await (await post()).json();
    await new Promise((r) => setTimeout(r, 100));
    const second = await post();
    assert.equal(second.status, 202);
    const third = await post();
    assert.equal(third.status, 429);
    const cancelled = await fetch(`${b}/agent/jobs/${first.id}`, { method: "DELETE", headers: { "x-fenix-owner": OWNER_A, authorization: `Bearer ${TOKEN}` } });
    assert.equal(cancelled.status, 200);
    const view = await (await fetch(`${b}/agent/jobs/${first.id}`, { headers: { "x-fenix-owner": OWNER_A, authorization: `Bearer ${TOKEN}` } })).json();
    for (let i=0;i<30 && view.status==="running";i++) { await new Promise(r=>setTimeout(r,20)); Object.assign(view,await (await fetch(`${b}/agent/jobs/${first.id}`, {headers:{"x-fenix-owner":OWNER_A,authorization:`Bearer ${TOKEN}`}})).json()); }
    assert.equal(view.status,"cancelled");
  } finally {
    slowStore.close();
    slow.close();
  }
});
