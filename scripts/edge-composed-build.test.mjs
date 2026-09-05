import assert from "node:assert/strict";
import { test } from "node:test";
import build from "../netlify/edge-functions/build.ts";
import { createBuildRequest, isAtomicStreamCreation } from "../src/lib/ai/build-request.ts";
import { composedBaseSha, composedBuildPalette } from "../workers/visual/composed-build.mjs";
import { ensureDomainImagery, upgradeProductChrome } from "../src/lib/ai/domain-imagery.ts";
import { validateProductHtml } from "../src/lib/projects/validate-html.ts";
import { grammarFromBrief } from "../src/lib/projects/layout-grammar.ts";

const brief = "FORMATO: app. kind=app. Agenda studio: appuntamenti e prenotazioni, stile iPhone.";
const request = body => new Request("https://fixture.invalid/api/build", {
  method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body),
});
const events = async response => (await response.text()).split("\n")
  .filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5)));
const planFor = html => ({ version:1, baseSha256:composedBaseSha(html), changes:[{
  find:"boot();\nsetTimeout(function(){ if(bootDone) return; finishBoot(false); }, 500);",
  replace:"boot();\n// Atomic transport fixture; not a visual quality improvement.\nsetTimeout(function(){ if(bootDone) return; finishBoot(false); }, 500);",
}] });
const stream = (content, reason = "stop") => new Response(
  `data: ${JSON.stringify({choices:[{delta:{content}, ...(reason ? {finish_reason:reason} : {})}]})}\n\ndata: [DONE]\n\n`,
  {headers:{"Content-Type":"text/event-stream"}},
);

async function withProvider(provider, run) {
  const previousFetch = globalThis.fetch;
  const previousNetlify = globalThis.Netlify;
  globalThis.Netlify = {env:{get:()=>"fixture-not-a-secret"}};
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.x.ai/v1/chat/completions");
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, "grok-build-0.1");
    assert.equal(Object.hasOwn(payload,"reasoningEffort"), false);
    return provider(payload);
  };
  try { return await run(); } finally {
    globalThis.fetch = previousFetch;
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  }
}

test("actual Edge create preserves composed head and palette through the normal product gate", async () => {
  const body = createBuildRequest({prompt:brief,kind:"app"});
  assert.equal(isAtomicStreamCreation(body),true);
  assert.equal(isAtomicStreamCreation({...body,operation:"edit"}),false);
  assert.equal(isAtomicStreamCreation({...body,html:"<html></html>"}),false);
  let calls = 0;
  await withProvider(payload => {
    calls++;
    assert.equal(calls,1,"no full-document QA rewrite for a valid composition");
    assert.match(payload.messages[0].content,/Rispondi SOLO JSON/);
    assert.ok(payload.messages[1].content.endsWith(body.html));
    assert.ok(payload.messages[1].content.includes(`BASE_SHA256:${composedBaseSha(body.html)}`));
    return stream(JSON.stringify(planFor(body.html)));
  }, async () => {
    const result = await events(await build(request(body)));
    assert.equal(result.at(-1).t,"ok",JSON.stringify(result.at(-1)));
    assert.equal(result.at(-1).result.html.split("<body")[0],body.html.split("<body")[0]);
    assert.deepEqual(result.at(-1).result.palette,composedBuildPalette(body.palette));
    assert.match(result.at(-1).result.html,/Atomic transport fixture/);
  });
});

test("Barber shop request uses appointments and repairs broken JS string quoting through actual Edge", async () => {
  const prompt = "FORMATO: app telefono 390×844. kind=app. Tab in basso, 5 schermate. NON un sito.\n\nmi crei un app da parrucchieri stile Barber shop";
  const body = createBuildRequest({prompt, kind:"app"});
  assert.equal(grammarFromBrief(prompt).id,"agenda");
  assert.equal(isAtomicStreamCreation(body),true);
  assert.match(body.html,/<nav[^>]*id="tabs"/);
  assert.match(body.html,/data-act="advance"/);
  const broken = "const barberLabel = 'Barber\nshop';\nboot();";
  const fixed = "const barberLabel = 'Barber shop';\nboot();";
  const initial = planFor(body.html);
  initial.changes[0].replace = broken;
  const damaged = body.html.replace(initial.changes[0].find,()=>broken);
  let calls = 0;
  await withProvider(payload => {
    calls++;
    assert.match(payload.messages[0].content,/Rispondi SOLO JSON/);
    if (calls === 1) return stream(JSON.stringify(initial));
    assert.equal(calls,2,"one located repair must complete without another generation");
    assert.match(payload.messages[1].content,/Script 1 \(riga \d+:\d+\)/);
    assert.ok(payload.messages[1].content.includes(`BASE_SHA256:${composedBaseSha(damaged)}`));
    const plan = {version:1,baseSha256:composedBaseSha(damaged),changes:[{find:broken,replace:fixed}]};
    return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(plan)}}]});
  }, async () => {
    const output = await events(await build(request(body)));
    assert.equal(output.at(-1).t,"ok",JSON.stringify(output.at(-1)));
    const html = output.at(-1).result.html;
    assert.equal(validateProductHtml(html,{kind:"app"}).ok,true);
    assert.ok(html.includes(fixed));
    assert.equal(html.split("<body")[0],body.html.split("<body")[0]);
    assert.deepEqual(output.at(-1).result.palette,composedBuildPalette(body.palette));
    assert.equal(calls,2);
  });
});

test("a syntactically invalid atomic result gets at most two atomic repairs, never full rewrites", async () => {
  const body=createBuildRequest({prompt:brief,kind:"app"});
  let calls=0;
  await withProvider(payload=>{
    calls++;
    assert.match(payload.messages[0].content,/Rispondi SOLO JSON/);
    if(calls===1){
      const plan=planFor(body.html);
      plan.changes[0].replace="const = ;";
      return stream(JSON.stringify(plan));
    }
    assert.ok(calls<=3,"two repairs maximum");
    assert.equal(payload.stream,false);
    assert.match(payload.messages[1].content,/ERRORI:/);
    return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify({...planFor(body.html),baseSha256:"0".repeat(64)})}}]});
  },async()=>{
    const output=await events(await build(request(body)));
    assert.equal(output.at(-1).t,"err");
    assert.equal(calls,3);
    assert.equal(output.some(event=>event.t==="ok"),false);
  });
});

test("imagery adaptation cannot rewrite JS templates or break a composed app at the gate",()=>{
  for(const domain of ["Agenda appuntamenti","Essenza profumi","Vesti abbigliamento","RepoVoci repository note","Osteria ristorazione"]){
    const prompt=`FORMATO: app. kind=app. ${domain}, stile iPhone.`;
    const {html}=createBuildRequest({prompt,kind:"app"});
    assert.equal(validateProductHtml(html,{kind:"app"}).syntaxOk,true,domain);
    const upgraded=upgradeProductChrome(html,prompt);
    assert.equal(upgraded,html,domain+" composed imagery already belongs to the product");
    assert.equal(validateProductHtml(upgraded,{kind:"app"}).syntaxOk,true,domain);
  }
  const js=`<script>const template='<div class="hero">literal $&</div>';</script>`;
  const html=`<html><head></head><body><main><div class="hero">Placeholder</div></main>${js}</body></html>`;
  const result=ensureDomainImagery(html,"Agenda appuntamenti");
  assert.ok(result.includes(js),"raw JS must remain byte-identical");
  assert.match(result,/data-imagery="domain"/,"real legacy markup still gets imagery");
  assert.equal(validateProductHtml(result,{kind:"app"}).syntaxOk,true);
});

test("invalid atomic plans and incomplete streams cannot fall back to HTML, QA or repairs", async () => {
  const body = createBuildRequest({prompt:brief,kind:"app"});
  for (const mode of ["stale","rewrite","length","missing-stop","oversize"]) {
    let calls = 0;
    await withProvider(() => {
      calls++;
      assert.equal(calls,1,mode);
      const plan = planFor(body.html);
      if (mode === "stale") plan.baseSha256="0".repeat(64);
      return stream(mode === "rewrite" ? body.html : mode === "oversize" ? "x".repeat(120001) : JSON.stringify(plan),
        mode === "length" ? "length" : mode === "missing-stop" ? "" : "stop");
    }, async () => {
      const output = await events(await build(request(body)));
      assert.equal(output.filter(event=>event.t==="ok").length,0,mode);
      assert.equal(output.filter(event=>event.t==="err").length,1,mode);
    });
  }
  await withProvider(()=>assert.fail("invalid palette must fail before provider call"),async()=>{
    assert.equal((await build(request({...body,palette:{...body.palette,accent:"red"}}))).status,400);
  });
});

test("full-stack/login contracts retain FILE generation instead of an HTML-only plan", async () => {
  const body = createBuildRequest({prompt:brief+" Doppio login titolare e cliente con backend.",kind:"app"});
  assert.equal(isAtomicStreamCreation(body),false);
  let calls=0;
  await withProvider(payload=>{
    calls++;
    assert.doesNotMatch(payload.messages[0].content,/Rispondi SOLO JSON/);
    assert.match(payload.messages[1].content,/backend\/fenix\.backend\.json/);
    assert.match(payload.messages[1].content,/<<<FILE/);
    return new Response("fixture-stop",{status:503});
  },async()=>{
    const output=await events(await build(request(body)));
    assert.equal(output.at(-1).t,"err");
    assert.equal(calls,1);
  });
});
