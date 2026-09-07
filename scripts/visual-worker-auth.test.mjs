import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

async function freePort() {
  const srv = createServer();
  srv.listen(0, "127.0.0.1");
  await once(srv, "listening");
  const { port } = srv.address();
  await new Promise((r) => srv.close(r));
  return port;
}

async function startWorker(env) {
  const port = await freePort();
  const worker = spawn(process.execPath, ["workers/visual/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { PATH: process.env.PATH, PORT: String(port), XAI_API_KEY: "fixture-not-a-secret", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout.resume();
  worker.stderr.resume();
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(300) })).ok) break; } catch { /* not yet */ }
    await delay(50);
  }
  return { base, stop: async () => { worker.kill("SIGKILL"); await once(worker, "exit"); } };
}

const post = (base, path, headers = {}) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ prompt: "app barbiere agenda", operation: "create" }) });

test("with VISUAL_WORKER_TOKEN set, jobs need the bearer token and CORS is closed", { timeout: 30_000 }, async () => {
  const { base, stop } = await startWorker({ VISUAL_WORKER_TOKEN: "worker-secret-0123456789" });
  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).auth, "token");
    assert.equal(health.headers.get("access-control-allow-origin"), null);
    assert.equal((await post(base, "/build")).status, 401);
    assert.equal((await post(base, "/polish", { authorization: "Bearer wrong-secret-0123456789" })).status, 401);
    assert.equal((await fetch(`${base}/jobs/abc`)).status, 401);
    const ok = await post(base, "/build", { authorization: "Bearer worker-secret-0123456789" });
    const receipt = await ok.json();
    assert.equal(ok.status, 202, JSON.stringify(receipt));
    const { id } = receipt;
    assert.match(id, /^[0-9a-f-]{36}$/, "job id is a uuid");
    const options = await fetch(`${base}/build`, { method: "OPTIONS" });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("access-control-allow-origin"), null);
  } finally {
    await stop();
  }
});

test("on Railway without a token the worker fails closed (503), health stays public", { timeout: 30_000 }, async () => {
  const { base, stop } = await startWorker({ RAILWAY_ENVIRONMENT: "production" });
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    const r = await post(base, "/build");
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /VISUAL_WORKER_TOKEN/);
  } finally {
    await stop();
  }
});

test("local dev without token or production marker stays open (fixtures keep working)", { timeout: 30_000 }, async () => {
  const { base, stop } = await startWorker({});
  try {
    assert.equal((await fetch(`${base}/health`).then((r) => r.json())).auth, "open");
    assert.equal((await post(base, "/build")).status, 202);
  } finally {
    await stop();
  }
});

test("FENIX_ORIGIN enables CORS only for that origin", { timeout: 30_000 }, async () => {
  const { base, stop } = await startWorker({ FENIX_ORIGIN: "https://fenix.kreluna.it" });
  try {
    const r = await fetch(`${base}/health`);
    assert.equal(r.headers.get("access-control-allow-origin"), "https://fenix.kreluna.it");
  } finally {
    await stop();
  }
});
