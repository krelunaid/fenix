import assert from "node:assert/strict";
import { composedBaseSha } from "../../workers/visual/composed-build.mjs";

// Loaded explicitly by test workers only. All provider requests stay in-process.
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.x.ai/v1/chat/completions");
  const request = JSON.parse(options.body);
  assert.equal(request.model, "grok-build-0.1");
  assert.equal(Object.hasOwn(request, "reasoningEffort"), false);
  assert.match(request.messages[0].content, /NON limitarti a cambiare colori/);
  const user = request.messages[1].content;
  const html = user.slice(user.indexOf("HTML ORIGINALE:\n") + "HTML ORIGINALE:\n".length);
  assert.ok(html.endsWith("</html>"));
  assert.ok(user.includes(`BASE_SHA256:${composedBaseSha(html)}`));
  console.log("COMPOSED_BUILD_PROVIDER_CALL");
  const plan = { version: 1, baseSha256: composedBaseSha(html), changes: [{
    find: 'var nome=(f.n && f.n.value || "").trim();',
    replace: 'var nome=(f.n && f.n.value || "").replace(/\\s+/g," ").trim();',
  }] };
  if (user.includes("WRONG_BASE_FIXTURE")) plan.baseSha256 = "0".repeat(64);
  if (user.includes("SYNTAX_FIXTURE")) plan.changes[0].replace = "const = ;";
  if (user.includes("MISSING_FIXTURE")) plan.changes[0].find = "function doesNotExist(){";
  let content = JSON.stringify(plan);
  if (user.includes("REWRITE_FIXTURE")) content = html;
  const finish_reason = user.includes("LENGTH_FIXTURE") ? "length" : "stop";
  return new Response(JSON.stringify({choices:[{finish_reason,message:{content}}]}), {
    status:200,headers:{"Content-Type":"application/json"},
  });
};
