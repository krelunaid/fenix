import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { applyIconRevision, AGENDA_ICON_INSTRUCTION } from "../workers/visual/icon-patch.mjs";

test("worker reports rejected and broken edits as errors, then accepts a valid atomic edit", { timeout: 15000 }, async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const worker = spawn(process.execPath, ["workers/visual/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    // No provider credentials; these atomic requests never need a model.
    env: { PATH: process.env.PATH, PORT: String(port), XAI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(worker, "exit");
  worker.stdout.resume();
  worker.stderr.resume();
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        ready = (await fetch(`${base}/health`, { signal: AbortSignal.timeout(300) })).ok;
        if (ready) break;
      } catch {}
      await delay(50);
    }
    assert.ok(ready);
    const shell = '<!doctype html><html><body><main><p>Saved data stays here.</p></main><nav><button data-view="home" data-fenix-id="icon:home"><svg viewBox="0 0 24 24"><path d="M2 2h20"/></svg>Oggi</button></nav>SCRIPT</body></html>';
    const valid = shell.replace("SCRIPT", '<script>window.saved="unchanged";</script>');
    const broken = shell.replace("SCRIPT", '<script>const broken = ;</script>');
    // Ensure the syntax case reaches the queue result gate, not icon rejection.
    assert.equal(applyIconRevision({ html: broken, instruction: AGENDA_ICON_INSTRUCTION }).status, "ok");
    const cases = [
      { html: valid, instruction: "Cambia solo l'icona della tab Fantasma", status: "err", error: /icona|nodo|target/i },
      { html: broken, instruction: AGENDA_ICON_INSTRUCTION, status: "err", error: /HTML non valido/i },
      { html: valid, instruction: AGENDA_ICON_INSTRUCTION, status: "ok" },
    ];
    const ids = new Set();
    for (const item of cases) {
      const response = await fetch(`${base}/polish`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "outcome-fixture" },
        body: JSON.stringify({ prompt: "Agenda fixture", projectId: "outcome-fixture", kind: "app", html: item.html, instruction: item.instruction }),
        signal: AbortSignal.timeout(2000),
      });
      assert.equal(response.status, 202);
      const receipt = await response.json();
      assert.ok(!ids.has(receipt.id), "finished/failed jobs must not trap the next request");
      ids.add(receipt.id);
      let job;
      for (let i = 0; i < 60; i++) {
        job = await (await fetch(`${base}/jobs/${receipt.id}`, { signal: AbortSignal.timeout(1000) })).json();
        if (job.status !== "run") break;
        await delay(20);
      }
      assert.equal(job.status, item.status, item.instruction);
      if (item.status === "err") {
        assert.match(job.error, item.error);
        assert.equal(job.html, null, "failed artifact must not be promoted");
      } else {
        assert.equal(job.html, applyIconRevision({ html: valid, instruction: item.instruction }).html);
        assert.ok(job.html.includes('<script>window.saved="unchanged";</script>'));
      }
      assert.equal((await (await fetch(`${base}/health`)).json()).jobs, 0);
    }
  } finally {
    worker.kill("SIGTERM");
    await exited;
  }
});
