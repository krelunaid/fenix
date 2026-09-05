import assert from "node:assert/strict";
let fontRecoveryCalls = 0;

// Explicit --import test fixture only: no real provider/network access.
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.x.ai/v1/chat/completions");
  const request = JSON.parse(options.body);
  assert.equal(request.model, "grok-build-0.1");
  assert.equal(Object.hasOwn(request, "reasoningEffort"), false);
  assert.match(request.messages[0].content, /Rifinisci SOLO il ritmo visivo/);
  assert.ok(request.messages[1].content.endsWith("</html>"), "complete artifact context");
  const bad = request.messages[1].content.includes("STYLE_REJECT_FIXTURE");
  const fontRecovery = request.messages[1].content.includes("STYLE_FONT_RECOVER_FIXTURE");
  if(fontRecovery && ++fontRecoveryCalls > 1) {
    assert.match(request.messages.at(-1).content,/Stile non consentito: font-size/);
    assert.match(request.messages.at(-1).content,/14px e 40px/);
  }
  console.log("VISUAL_STYLE_PROVIDER_CALL");
  return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
    version: 1,
    rules: [{ selector: ".brand", declarations: bad ? { display: "none" } : { "font-size": fontRecovery && fontRecoveryCalls === 1 ? "13px" : "28px" } }],
  }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
};
