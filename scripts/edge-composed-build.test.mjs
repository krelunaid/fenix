import assert from "node:assert/strict";
import { test } from "node:test";
import build from "../netlify/edge-functions/build.ts";
import { createBuildRequest, isAtomicStreamCreation } from "../src/lib/ai/build-request.ts";
import { composedBuildPalette } from "../workers/visual/composed-build.mjs";
import { ensureDomainImagery, upgradeProductChrome } from "../src/lib/ai/domain-imagery.ts";
import { validateProductHtml } from "../src/lib/projects/validate-html.ts";
import { grammarFromBrief } from "../src/lib/projects/layout-grammar.ts";
import { isModelCreatedArtifact } from "../workers/visual/composed-create.mjs";
import { createdMetaHtml } from "./fixtures/composed-create-html.mjs";

const brief = "FORMATO: app. kind=app. Agenda studio: appuntamenti e prenotazioni, stile iPhone.";
const request = body => new Request("https://fixture.invalid/api/build", {
  method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body),
});
const events = async response => (await response.text()).split("\n")
  .filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5)));
const stream = (content, reason = "stop") => new Response(
  `data: ${JSON.stringify({choices:[{delta:{content}, ...(reason ? {finish_reason:reason} : {})}]})}\n\ndata: [DONE]\n\n`,
  {headers:{"Content-Type":"text/event-stream"}},
);

function isCreateSystem(payload) {
  return /documento HTML originale/.test(payload.messages[0].content);
}

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

test("actual Edge create applies original grok-build HTML instead of patching the seed", async () => {
  const body = createBuildRequest({prompt:brief,kind:"app"});
  assert.equal(isAtomicStreamCreation(body),true);
  assert.equal(isAtomicStreamCreation({...body,operation:"edit"}),false);
  assert.equal(isAtomicStreamCreation({...body,html:"<html></html>"}),false);
  let calls = 0;
  await withProvider(payload => {
    calls++;
    assert.equal(isCreateSystem(payload), true);
    assert.doesNotMatch(payload.messages[0].content, /Rispondi SOLO JSON/);
    assert.doesNotMatch(payload.messages[1].content, /HTML ORIGINALE:/);
    assert.doesNotMatch(payload.messages[1].content, /BASE_SHA256:/);
    return stream(createdMetaHtml());
  }, async () => {
    const result = await events(await build(request(body)));
    assert.equal(result.at(-1).t,"ok",JSON.stringify(result.at(-1)));
    const html = result.at(-1).result.html;
    assert.ok(isModelCreatedArtifact(html));
    assert.notEqual(html.split("<body")[0], body.html.split("<body")[0]);
    assert.match(html, /Atelier Nova/);
    assert.deepEqual(result.at(-1).result.palette, composedBuildPalette({
      bg:"#1b1410",surface:"#2a211c",fg:"#f4ece4",muted:"#b9a89a",accent:"#c45c26",
    }));
    assert.equal(calls,1,"valid original HTML skips critic and atomic retries");
  });
});

test("Barber shop request keeps the seed at t0 and replaces it with a model document", async () => {
  const prompt = "FORMATO: app telefono 390×844. kind=app. Tab in basso, 5 schermate. NON un sito.\n\nmi crei un app da parrucchieri stile Barber shop";
  const body = createBuildRequest({prompt, kind:"app"});
  assert.equal(grammarFromBrief(prompt).id,"agenda");
  assert.equal(isAtomicStreamCreation(body),true);
  assert.match(body.html,/<nav[^>]*id="tabs"/);
  let calls = 0;
  await withProvider(payload => {
    calls++;
    assert.equal(isCreateSystem(payload), true);
    return stream(createdMetaHtml("Sala Nova"));
  }, async () => {
    const output = await events(await build(request(body)));
    assert.equal(output.at(-1).t,"ok",JSON.stringify(output.at(-1)));
    const html = output.at(-1).result.html;
    assert.equal(validateProductHtml(html,{kind:"app"}).ok,true);
    assert.ok(isModelCreatedArtifact(html));
    assert.match(html,/Sala Nova/);
    assert.doesNotMatch(html,/data-fenix-craft/);
    assert.equal(calls,1);
  });
});

test("invalid create documents retry once then keep the seed if QA also fails", async () => {
  const body=createBuildRequest({prompt:brief,kind:"app"});
  let calls=0;
  await withProvider(payload=>{
    calls++;
    if (isCreateSystem(payload)) {
      return calls === 1 ? stream("not-html") : Response.json({choices:[{finish_reason:"stop",message:{content:"still-not-html"}}]});
    }
    return Response.json({choices:[{finish_reason:"stop",message:{content:""}}]});
  },async()=>{
    const output = await events(await build(request(body)));
    assert.equal(output.at(-1).t,"ok");
    assert.equal(output.at(-1).result.html, body.html);
    assert.ok(output.some(event => event.t==="s" && /seed composto invariato/.test(event.s)));
    assert.ok(calls>=2 && calls<=3);
  });
});

test("QA after a Fenix seed can still apply an original grok-build document", async () => {
  const body=createBuildRequest({prompt:brief,kind:"app"});
  let calls=0;
  await withProvider(payload=>{
    calls++;
    assert.equal(isCreateSystem(payload), true);
    if (calls <= 2) {
      return calls === 1 ? stream("not-html") : Response.json({choices:[{finish_reason:"stop",message:{content:"still-not-html"}}]});
    }
    return Response.json({choices:[{finish_reason:"stop",message:{content:createdMetaHtml()}}]});
  },async()=>{
    const output = await events(await build(request(body)));
    assert.equal(output.at(-1).t,"ok",JSON.stringify(output.at(-1)));
    assert.ok(isModelCreatedArtifact(output.at(-1).result.html));
    assert.match(output.at(-1).result.html,/Atelier Nova/);
    assert.ok(calls>=3);
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

test("first invalid create retries on the original brief and then applies", async () => {
  const body = createBuildRequest({prompt:brief,kind:"app"});
  let calls = 0;
  await withProvider(payload => {
    calls++;
    if (isCreateSystem(payload) && calls === 1) return stream("not-html");
    assert.equal(payload.stream, false);
    return Response.json({choices:[{finish_reason:"stop",message:{content:createdMetaHtml()}}]});
  }, async () => {
    const result = await events(await build(request(body)));
    assert.equal(result.at(-1).t,"ok",JSON.stringify(result.at(-1)));
    assert.ok(isModelCreatedArtifact(result.at(-1).result.html));
    assert.match(result.at(-1).result.html,/Atelier Nova/);
    assert.equal(calls,2);
  });
});

test("exhausted create retries keep the seed and never require a JSON plan", async () => {
  const body = createBuildRequest({prompt:brief,kind:"app"});
  let calls = 0;
  await withProvider(payload => {
    calls++;
    assert.doesNotMatch(payload.messages[1].content, /HTML ORIGINALE:/);
    if (isCreateSystem(payload)) {
      return calls === 1 ? stream("not-html") : Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify({version:1,changes:[]})}}]});
    }
    return Response.json({choices:[{finish_reason:"stop",message:{content:""}}]});
  }, async () => {
    const output = await events(await build(request(body)));
    assert.equal(output.at(-1).t,"ok",JSON.stringify(output.at(-1)));
    assert.equal(output.at(-1).result.html, body.html);
    assert.ok(output.some(event => event.t==="s" && /seed composto invariato/.test(event.s)));
    assert.ok(calls>=2 && calls<=3);
  });
});

test("invalid or incomplete create answers keep the seed; palette still fails closed", async () => {
  const body = createBuildRequest({prompt:brief,kind:"app"});
  for (const mode of ["rewrite","length","missing-stop","oversize"]) {
    let calls = 0;
    await withProvider(payload => {
      calls++;
      const content = mode === "rewrite"
        ? body.html
        : mode === "oversize" ? "x".repeat(120001)
        : createdMetaHtml();
      if (isCreateSystem(payload) && payload.stream) {
        return stream(content, mode === "length" ? "length" : mode === "missing-stop" ? "" : "stop");
      }
      if (isCreateSystem(payload)) {
        return Response.json({choices:[{finish_reason:"stop",message:{content:"not-html"}}]});
      }
      return Response.json({choices:[{finish_reason:"stop",message:{content:""}}]});
    }, async () => {
      const output = await events(await build(request(body)));
      assert.equal(output.at(-1).t,"ok",mode);
      if (mode === "rewrite" || mode === "length" || mode === "missing-stop" || mode === "oversize") {
        assert.equal(output.at(-1).result.html, body.html, mode);
      }
      assert.ok(calls>=1,mode);
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
