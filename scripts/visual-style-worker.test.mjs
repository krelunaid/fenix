import assert from "node:assert/strict";
import { test } from "node:test";
import { withComposedWorker } from "./fixtures/composed-build-worker.mjs";

// /polish now requests a complete original document, not the retired CSS-only
// provider contract. A JSON style plan must never replace the seed.
test("composed polish rejects CSS-only provider output and preserves the seed", { timeout: 30000 }, async () => {
  await withComposedWorker(async ({base, calls}) => {
    const html = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>:root{--accent:#225566}</style></head><body><nav id="tabs"><button data-view="oggi">Oggi</button></nav><main id="root">$&</main><script>window.saved="$&";</script></body></html>';
    const response = await fetch(base + "/polish", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({prompt:"JSON_PLAN_FIXTURE agenda", html, kind:"app"}),
      signal: AbortSignal.timeout(2000),
    });
    assert.equal(response.status, 202);
    const {id} = await response.json();
    let job;
    for (let i=0; i<160; i++) {
      job = await (await fetch(base + "/jobs/" + id, {signal:AbortSignal.timeout(1000)})).json();
      if (job.status !== "run") break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(job.status, "ok", JSON.stringify(job));
    assert.equal(job.html, html);
    assert.equal(job.error, null);
    assert.match(job.log.join(" "), /seed composto invariato/);
    assert.doesNotMatch(job.html, /data-fenix-visual-style/);
    assert.equal(calls(), 2, "invalid document receives one bounded retry");
  });
});
