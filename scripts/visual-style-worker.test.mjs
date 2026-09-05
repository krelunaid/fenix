import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { applyVisualStylePlan } from "../workers/visual/visual-style.mjs";

test("automatic composed polish rejects unsafe, absent and ineffective style plans", { timeout: 30000 }, async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const worker = spawn(process.execPath, ["--import", "./scripts/fixtures/visual-style-provider.mjs", "workers/visual/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { PATH: process.env.PATH, PORT: String(port), XAI_API_KEY: "fixture-not-a-secret" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(worker, "exit");
  let output = "";
  worker.stdout.on("data", chunk => { output += chunk; });
  worker.stderr.resume();
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(300) })).ok) { ready = true; break; } } catch {}
      await delay(50);
    }
    assert.ok(ready);
    const html = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>:root{--accent:#225566}</style></head><body><nav id="tabs"><button data-view="oggi">Oggi</button></nav><main id="root">$&</main><script>window.saved="$&";</script></body></html>';
    for (const mode of ['valid', 'unsafe', 'absent', 'ineffective', 'font-recovery']) {
      const artifact = mode === 'absent' ? html : html.replace('</head>', `<style>.brand{font-size:${mode === 'ineffective' ? 28 : 16}px}</style></head>`).replace('<main', '<header class="brand">Agenda</header><main');
      const response = await fetch(`${base}/polish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: mode === 'unsafe' ? "STYLE_REJECT_FIXTURE" : mode === 'font-recovery' ? "STYLE_FONT_RECOVER_FIXTURE" : "Agenda leggibile", html: artifact, kind: "app" }),
        signal: AbortSignal.timeout(2000),
      });
      assert.equal(response.status, 202);
      const receipt = await response.json();
      let job;
      for (let i = 0; i < 160; i++) {
        job = await (await fetch(`${base}/jobs/${receipt.id}`, { signal: AbortSignal.timeout(1000) })).json();
        if (job.status !== "run") break;
        await delay(50);
      }
      const success = mode === 'valid' || mode === 'font-recovery';
      assert.equal(job.status, success ? 'ok' : 'err', mode);
      if (!success) {
        assert.match(job.error, mode === 'unsafe' ? /Stile non consentito: display/ : mode === 'absent' ? /Target visuale assente/ : /nessun effetto visibile/);
        assert.equal(job.html, null);
      } else {
        assert.equal(job.html, applyVisualStylePlan(artifact, { version: 1, rules: [{ selector: ".brand", declarations: { "font-size": "28px" } }] }));
        assert.match(job.log.join(" "), /palette preservati/);
        if(mode === 'font-recovery') assert.match(job.log.join(" "), /1\/2 ripari/);
      }
    }
    assert.equal((output.match(/VISUAL_STYLE_PROVIDER_CALL/g) || []).length, 12, "one initial plan, at most two repairs per rejected plan; font recovers after one; no icon/image/HTML fallback");
  } finally {
    worker.kill("SIGTERM");
    await exited;
  }
});
