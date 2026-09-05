import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { withComposedWorker } from "./fixtures/composed-build-worker.mjs";

test("composed /build applies one functional plan, rejects bad plans and never rewrites", {timeout:30000}, async () => {
  await withComposedWorker(async ({base,build,calls}) => {
    const html = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>body{color:#102030}</style></head><body><main id="root">Agenda</main><nav id="tabs"><button>Home</button></nav>'+' '.repeat(51000)+'<script>function save(f){var nome=(f.n && f.n.value || "").trim();return nome;}</script></body></html>';
    const modes = ["VALID_FIXTURE","WRONG_BASE_FIXTURE","SYNTAX_FIXTURE","MISSING_FIXTURE","REWRITE_FIXTURE","LENGTH_FIXTURE"];
    const palette = {bg:"#ffffff",surface:"#eeeeee",fg:"#102030",muted:"#334455",accent:"#125e57"};
    for (const prompt of modes) {
      const job = await build({prompt,html,kind:"app",operation:"create",palette});
      assert.equal(job.status,prompt==="VALID_FIXTURE"?"ok":"err",prompt);
      if (prompt==="VALID_FIXTURE") {
        assert.deepEqual(job.meta.palette,palette);
        assert.equal(job.html.split("<body>")[0],html.split("<body>")[0]);
        assert.ok(job.html.includes('var nome=(f.n && f.n.value || "").replace(/\\s+/g," ").trim()'));
        assert.ok(job.html.endsWith("</script></body></html>"));
      } else {
        assert.equal(job.html,null,prompt);
        assert.ok(job.error,prompt);
      }
    }
    assert.equal(calls(),modes.length,"one provider request per job; no icon/image/rewrite fallback");
    const badPalette = await build({prompt:"bad metadata",html,kind:"app",operation:"create",palette:{...palette,accent:"red;display:none"}});
    assert.equal(badPalette.status,"err");
    assert.equal(badPalette.html,null);
    assert.equal(calls(),modes.length,"invalid palette rejected before provider call");
    const invalid = await fetch(`${base}/build`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:"invalid operation",operation:"replace-all"})});
    assert.equal(invalid.status,400);
    assert.equal(calls(),modes.length);
  });
});

test("controller wiring keeps composed worker failures out of automatic full-document retries", () => {
  const controller = readFileSync(new URL("../src/lib/ai/run-build.ts",import.meta.url),"utf8");
  const worker = controller.slice(controller.indexOf("async function consumeViaWorker("),controller.indexOf("async function consumeStream("));
  assert.match(worker,/if \(isComposedCreation\(body\)\) throw err/);
  assert.match(worker,/if \(isComposedCreation\(body\)\) throw new Error\(lastErr\)/);
  const guard=controller.indexOf("if ((isIOS() || desk) && isComposedCreation(payload)) throw first");
  assert.ok(guard>0 && guard<controller.indexOf("if (isTransientNetwork(msg))",guard));
  const edgeGuard=controller.indexOf("if (isAtomicStreamCreation(payload)) throw first");
  assert.ok(edgeGuard>guard && edgeGuard<controller.indexOf("if (isTransientNetwork(msg))",guard));
});
