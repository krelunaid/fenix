import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAICompatibleModel, toOpenAIMessages, fromOpenAIResponse } from "../workers/agent/model/openai.mjs";
import { createModel, byokFromHeaders } from "../workers/agent/model/index.mjs";
import { TOOLS } from "../workers/agent/tools.mjs";

test("messages translate both ways: tool_use ↔ tool_calls, tool_result ↔ tool role", () => {
  const msgs = [
    { role: "user", content: "brief" },
    { role: "assistant", content: [{ type: "text", text: "ok" }, { type: "tool_use", id: "t1", name: "write_file", input: { path: "a", content: "b" } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "Scritto a." }] },
  ];
  const out = toOpenAIMessages(msgs);
  assert.equal(out[0].role, "user");
  assert.equal(out[1].role, "assistant");
  assert.equal(out[1].tool_calls[0].id, "t1");
  assert.equal(JSON.parse(out[1].tool_calls[0].function.arguments).path, "a");
  assert.deepEqual(out[2], { role: "tool", tool_call_id: "t1", content: "Scritto a." });
  const back = fromOpenAIResponse({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "c9", function: { name: "run_checks", arguments: "{}" } }] } }], usage: { prompt_tokens: 5, completion_tokens: 2 } });
  assert.equal(back.stop_reason, "tool_use");
  assert.deepEqual(back.content[0], { type: "tool_use", id: "c9", name: "run_checks", input: {} });
  assert.equal(back.usage.input_tokens, 5);
  const text = fromOpenAIResponse({ choices: [{ finish_reason: "stop", message: { content: "fatto" } }] });
  assert.equal(text.stop_reason, "end_turn");
  assert.equal(text.content[0].text, "fatto");
});

test("request shape carries function tools; xai preset; retry on 429", async () => {
  const seen = [];
  let n = 0;
  const fetchImpl = async (url, init) => {
    seen.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization });
    n += 1;
    if (n === 1) return new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: "ciao" } }], usage: {} });
  };
  const m = new OpenAICompatibleModel({ provider: "xai", apiKey: "xai-key-0123456789", fetchImpl });
  const r = await m.complete({ system: "S", messages: [{ role: "user", content: "hi" }], tools: TOOLS });
  assert.equal(r.content[0].text, "ciao");
  assert.equal(seen.length, 2);
  assert.equal(seen[1].url, "https://api.x.ai/v1/chat/completions");
  assert.equal(seen[1].body.model, "grok-4");
  assert.equal(seen[1].body.tools[0].type, "function");
  assert.equal(seen[1].body.tools.length, TOOLS.length);
  assert.equal(seen[1].body.messages[0].role, "system");
  assert.equal(seen[1].auth, "Bearer xai-key-0123456789");
});

test("factory and BYOK header validation", () => {
  assert.equal(createModel({ provider: "anthropic", apiKey: "k".repeat(20) }).model.length > 0, true);
  assert.equal(createModel({ provider: "openai", apiKey: "k".repeat(20) }).provider, "openai");
  assert.throws(() => createModel({ provider: "nope", apiKey: "k" }), /non supportato/);
  assert.equal(byokFromHeaders({}), null);
  assert.deepEqual(byokFromHeaders({ "x-fenix-model-provider": "xai", "x-fenix-model-key": "x".repeat(20), "x-fenix-model": "grok-4" }), { provider: "xai", apiKey: "x".repeat(20), model: "grok-4" });
  assert.throws(() => byokFromHeaders({ "x-fenix-model-provider": "xai", "x-fenix-model-key": "short" }), /Chiave/);
  assert.throws(() => byokFromHeaders({ "x-fenix-model-provider": "evil", "x-fenix-model-key": "x".repeat(20) }), /Provider/);
});
