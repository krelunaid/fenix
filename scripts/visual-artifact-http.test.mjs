import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { MAX_ARTIFACT_CHARS } from "../workers/visual/artifact-context.mjs";

test("worker rejects oversized HTML before enqueue or any model call", {timeout:15000}, async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const worker = spawn(process.execPath, ["workers/visual/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    // Deliberately no inherited provider credentials. Only loopback requests.
    env: {PATH:process.env.PATH, PORT:String(port), XAI_API_KEY:""},
    stdio:["ignore", "pipe", "pipe"],
  });
  const exited = once(worker, "exit");
  let stderr = "";
  worker.stderr.on("data", chunk => { stderr += chunk; });
  worker.stdout.resume();
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (worker.exitCode !== null) throw new Error(stderr || "Worker exited early");
      try {
        const res = await fetch(`${base}/health`, {signal:AbortSignal.timeout(300)});
        if (res.ok) { ready = true; break; }
      } catch {}
      await delay(50);
    }
    assert.ok(ready, "worker must start");
    for (const route of ["build", "polish"]) {
      const response = await fetch(`${base}/${route}`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:"Fixture app", html:"x".repeat(MAX_ARTIFACT_CHARS+1)}),
        signal:AbortSignal.timeout(2000),
      });
      assert.equal(response.status, 413);
      assert.match((await response.json()).error, /versione precedente resta invariata/);
    }
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.jobs, 0);
    assert.equal(health.model, "grok-build-0.1");
  } finally {
    worker.kill("SIGTERM");
    await exited;
  }
});
