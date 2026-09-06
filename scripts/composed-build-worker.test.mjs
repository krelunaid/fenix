import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { withComposedWorker } from "./fixtures/composed-build-worker.mjs";
import { originalCreateHtml } from "./fixtures/composed-create-html.mjs";
import { originalSiteHtml } from "./fixtures/composed-desk-html.mjs";
import { isModelCreatedArtifact } from "../workers/visual/composed-create.mjs";

test("composed /build applies original grok-build HTML and keeps the seed when the document is invalid", {timeout:30000}, async () => {
  await withComposedWorker(async ({base,build,calls}) => {
    const html = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>body{color:#102030}</style></head><body><main id="root">Agenda</main><nav id="tabs"><button>Home</button></nav>'+' '.repeat(51000)+'<script>function save(f){var nome=(f.n && f.n.value || "").trim();return nome;}</script></body></html>';
    const palette = {bg:"#ffffff",surface:"#eeeeee",fg:"#102030",muted:"#334455",accent:"#125e57"};
    const original = originalCreateHtml();
    const applied = await build({prompt:"VALID_FIXTURE agenda studio",html,kind:"app",operation:"create",palette});
    assert.equal(applied.status,"ok");
    assert.notEqual(applied.html,html);
    assert.ok(isModelCreatedArtifact(applied.html));
    assert.ok(applied.html.includes("Atelier Nova"));
    assert.match(applied.html,/Fenix\.load/);
    assert.match(applied.html,/Fenix\.save/);
    assert.ok(applied.log.some(line => /Documento originale dal modello/.test(line)));
    assert.equal(applied.html.split("<body")[0] === html.split("<body")[0], false);

    const retried = await build({prompt:"RETRY_OK_FIXTURE agenda",html,kind:"app",operation:"create",palette});
    assert.equal(retried.status,"ok");
    assert.ok(isModelCreatedArtifact(retried.html));
    assert.ok(retried.html.includes(original.match(/<title>([^<]+)<\/title>/)[1]));

    for (const prompt of ["SEED_COPY_FIXTURE","REWRITE_FIXTURE","SYNTAX_FIXTURE","JSON_PLAN_FIXTURE","MISSING_FIXTURE","WRONG_BASE_FIXTURE","LENGTH_FIXTURE"]) {
      const job = await build({prompt,html,kind:"app",operation:"create",palette});
      assert.equal(job.status,"ok",prompt);
      assert.equal(job.html,html,prompt);
      assert.ok(job.log.some(line => /seed composto invariato/.test(line)),prompt);
      assert.equal(job.error,null,prompt);
    }

    const expectedCalls = 1 + 2 + 6 * 2 + 1;
    assert.equal(calls(),expectedCalls,"one create call, one retry on miss, two attempts on invalid documents");
    const badPalette = await build({prompt:"bad metadata",html,kind:"app",operation:"create",palette:{...palette,accent:"red;display:none"}});
    assert.equal(badPalette.status,"err");
    assert.equal(badPalette.html,null);
    assert.equal(calls(),expectedCalls,"invalid palette rejected before provider call");
    const invalid = await fetch(`${base}/build`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:"invalid operation",operation:"replace-all"})});
    assert.equal(invalid.status,400);
    assert.equal(calls(),expectedCalls);
  });
});

test("composed /polish rewrites a Fenix seed with grok-build instead of CSS-only", {timeout:30000}, async () => {
  await withComposedWorker(async ({base,calls}) => {
    const html = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>:root{--bg:#102030;--surface:#1a2a3a;--fg:#f4ece4;--muted:#9a8f7a;--accent:#125e57}</style></head><body><main id="root">Agenda</main><nav id="tabs"><button>Home</button></nav>'+' '.repeat(4000)+'<script>window.Fenix.load("s");window.Fenix.save("s",{});</script></body></html>';
    const response = await fetch(`${base}/polish`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:"VALID_FIXTURE polish seed",html,kind:"app"}),signal:AbortSignal.timeout(2000)});
    assert.equal(response.status,202);
    const receipt = await response.json();
    let job;
    for (let i=0;i<120;i++) {
      job = await (await fetch(`${base}/jobs/${receipt.id}`,{signal:AbortSignal.timeout(1000)})).json();
      if (job.status !== "run") break;
      await new Promise(r => setTimeout(r, 50));
    }
    assert.equal(job.status,"ok");
    assert.ok(isModelCreatedArtifact(job.html));
    assert.notEqual(job.html, html);
    assert.ok(job.log.some(line => /riscrive il seed/.test(line)));
    assert.equal(calls(),1);
  });
});

test("composed /polish leaves an original grok-build document untouched", {timeout:30000}, async () => {
  await withComposedWorker(async ({base,calls}) => {
    const html = originalCreateHtml().replace("<html", '<html data-fenix-model-create="1"');
    const response = await fetch(`${base}/polish`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:"VALID_FIXTURE already original",html,kind:"app"}),signal:AbortSignal.timeout(2000)});
    assert.equal(response.status,202);
    const receipt = await response.json();
    let job;
    for (let i=0;i<120;i++) {
      job = await (await fetch(`${base}/jobs/${receipt.id}`,{signal:AbortSignal.timeout(1000)})).json();
      if (job.status !== "run") break;
      await new Promise(r => setTimeout(r, 50));
    }
    assert.equal(job.status,"ok");
    assert.equal(job.html, html);
    assert.ok(job.log.some(line => /rifinitura CSS\/tab saltata/.test(line)));
    assert.equal(calls(),0);
  });
});

test("controller wiring keeps composed worker failures out of automatic full-document retries", () => {
  const controller = readFileSync(new URL("../src/lib/ai/run-build.ts",import.meta.url),"utf8");
  const worker = controller.slice(controller.indexOf("async function consumeViaWorker("),controller.indexOf("async function consumeStream("));
  assert.match(worker,/if \(isComposedCreation\(body\)\) throw err/);
  assert.match(worker,/if \(isComposedCreation\(body\)\) throw new Error\(lastErr\)/);
  assert.match(controller,/WORKER_START_MS = 30_000/);
  assert.match(controller,/AbortSignal\.timeout\(WORKER_START_MS\)/);
  assert.doesNotMatch(controller,/AbortSignal\.timeout\(8000\)/);
  assert.match(controller,/composedCreate\s*=\s*isComposedCreation\(payload\)/);
  assert.match(controller,/isIOS\(\) \|\| desk \|\| composedCreate/);
  const guard=controller.indexOf("if (composedCreate)");
  assert.ok(guard>0 && guard<controller.indexOf("if (isTransientNetwork(msg))",guard));
  assert.match(controller.slice(guard, guard+500), /persistComposedSeed/);
  const edgeGuard=controller.indexOf("if (isAtomicStreamCreation(payload))");
  assert.ok(edgeGuard>guard && edgeGuard<controller.indexOf("if (isTransientNetwork(msg))",guard));
});

test("composed /build writes original desktop site HTML instead of the magazine seed", {timeout:30000}, async () => {
  await withComposedWorker(async ({build,calls}) => {
    const seed = '<!doctype html><html data-fenix-website="1" data-grammar="magazine"><head><style data-fenix-site>body{color:#102030}</style></head><body><main id="main">Sito</main><nav><a href="#x">Home</a></nav>'+' '.repeat(2000)+'<script>window.Fenix.load("s");window.Fenix.save("s",{});</script></body></html>';
    const applied = await build({prompt:"VALID_FIXTURE sito brera",html:seed,kind:"site",operation:"create"});
    assert.equal(applied.status,"ok");
    assert.ok(isModelCreatedArtifact(applied.html));
    assert.ok(applied.html.includes("Atelier Luce"));
    assert.match(applied.html, /<footer\b/i);
    assert.ok(applied.log.some(line => /Documento desktop originale/.test(line)));
    assert.equal(calls(),1);
  });
});

test("composed /polish restyles an original desktop site instead of stripping chrome only", {timeout:30000}, async () => {
  await withComposedWorker(async ({base,calls}) => {
    const html = originalSiteHtml().replace("<html", '<html data-fenix-model-create="1"');
    const response = await fetch(`${base}/polish`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:"VALID_FIXTURE sito già originale",html,kind:"site"}),signal:AbortSignal.timeout(2000)});
    assert.equal(response.status,202);
    const receipt = await response.json();
    let job;
    for (let i=0;i<120;i++) {
      job = await (await fetch(`${base}/jobs/${receipt.id}`,{signal:AbortSignal.timeout(1000)})).json();
      if (job.status !== "run") break;
      await new Promise(r => setTimeout(r, 50));
    }
    assert.equal(job.status,"ok");
    assert.ok(isModelCreatedArtifact(job.html));
    assert.notEqual(job.html, html);
    assert.ok(job.html.includes("Sala · Brera") || /letter-spacing:-.05em/.test(job.html));
    assert.ok(job.log.some(line => /Passaggio grafico desktop/.test(line)));
    assert.equal(calls(),1);
  });
});
