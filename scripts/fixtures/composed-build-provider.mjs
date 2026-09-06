import assert from "node:assert/strict";
import { COMPOSED_CREATE_SYSTEM } from "../../workers/visual/composed-create.mjs";
import { originalCreateHtml } from "./composed-create-html.mjs";

// Loaded explicitly by test workers only. All provider requests stay in-process.
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.x.ai/v1/chat/completions");
  const request = JSON.parse(options.body);
  assert.equal(request.model, "grok-build-0.1");
  assert.equal(Object.hasOwn(request, "reasoningEffort"), false);
  assert.equal(request.temperature, 0.8);
  assert.equal(request.max_tokens, 20000);
  assert.equal(request.messages[0].content, COMPOSED_CREATE_SYSTEM);
  assert.match(request.messages[0].content, /documento HTML originale/);
  assert.doesNotMatch(request.messages[0].content, /Rispondi SOLO JSON/);
  const user = request.messages[1].content;
  assert.match(user, /BRIEF:/);
  assert.doesNotMatch(user, /HTML ORIGINALE:/);
  assert.doesNotMatch(user, /BASE_SHA256/);
  const retrying = /documento precedente non è un'app originale valida/.test(user);
  console.log("COMPOSED_BUILD_PROVIDER_CALL");
  const original = originalCreateHtml();
  const wrapped = `<<<META>>>
{"name":"Atelier Nova","tagline":"Sala prove","kind":"app","summary":"Prenotazioni","palette":{"bg":"#1b1410","surface":"#2a211c","fg":"#f4ece4","muted":"#b9a89a","accent":"#c45c26"}}
<<<HTML>>>
${original}
<<<END>>>`;
  if (user.includes("LENGTH_FIXTURE") && !retrying) {
    return new Response(JSON.stringify({choices:[{finish_reason:"length",message:{content:wrapped}}]}), {
      status:200,headers:{"Content-Type":"application/json"},
    });
  }
  if (user.includes("SYNTAX_FIXTURE")) {
    const broken = original.replace("var KEY=\"state\";", "const = ;");
    return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:broken}}]}), {
      status:200,headers:{"Content-Type":"application/json"},
    });
  }
  if (user.includes("SEED_COPY_FIXTURE") || user.includes("REWRITE_FIXTURE")) {
    const html = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>body{color:#102030}</style></head><body><main id="root">Agenda</main><nav id="tabs"><button data-view="oggi">Oggi</button></nav><script>window.Fenix.load("s");window.Fenix.save("s",{});</script></body></html>'
      + " ".repeat(3000);
    return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:html}}]}), {
      status:200,headers:{"Content-Type":"application/json"},
    });
  }
  if (user.includes("JSON_PLAN_FIXTURE") || user.includes("MISSING_FIXTURE") || user.includes("WRONG_BASE_FIXTURE")) {
    return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify({version:1,changes:[]})}}]}), {
      status:200,headers:{"Content-Type":"application/json"},
    });
  }
  if (user.includes("RETRY_OK_FIXTURE") && !retrying) {
    return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:"not-html"}}]}), {
      status:200,headers:{"Content-Type":"application/json"},
    });
  }
  return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:wrapped}}]}), {
    status:200,headers:{"Content-Type":"application/json"},
  });
};
