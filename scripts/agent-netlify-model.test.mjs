import assert from "node:assert/strict";
import { test } from "node:test";
import { handleAgentModelBackground, handleAgentModelStatus, safeTokenEqual } from "../src/lib/agent/model-relay.ts";
import { NetlifyRelayModel } from "../workers/agent/model/netlify.mjs";

const TOKEN = "relay-token-0123456789abcdef";
const ID = "12345678-1234-4234-8234-123456789abc";

function memoryStore() {
  const data = new Map();
  return {
    data,
    async get(key) { return data.get(key) || null; },
    async setJSON(key, value) { data.set(key, structuredClone(value)); },
  };
}

const auth = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };
const env = (name) => ({ AGENT_TOKEN: TOKEN, ANTHROPIC_API_KEY: "gateway-key", ANTHROPIC_BASE_URL: "https://gateway.example/anthropic", ANTHROPIC_MODEL: "claude-sonnet-4-5" })[name];

test("model relay rejects missing auth and validates identifiers", async () => {
  const store = memoryStore();
  assert.equal(safeTokenEqual(TOKEN, TOKEN), true);
  assert.equal(safeTokenEqual("wrong", TOKEN), false);
  const badAuth = await handleAgentModelStatus(new Request(`https://x/api/agent-model/${ID}`), ID, { store, env });
  assert.equal(badAuth.status, 401);
  const badId = await handleAgentModelStatus(new Request("https://x/api/agent-model/no", { headers: auth }), "no", { store, env });
  assert.equal(badId.status, 400);
});

test("background relay pins the model and persists a pollable response", async () => {
  const store = memoryStore();
  let forwarded;
  const req = new Request("https://x/api/agent-model", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ id: ID, request: { model: "untrusted", max_tokens: 99_999, system: [{ type: "text", text: "S" }], messages: [{ role: "user", content: "ciao" }], tools: [] } }),
  });
  const accepted = await handleAgentModelBackground(req, {
    store,
    env,
    now: () => 42,
    fetchImpl: async (url, init) => {
      forwarded = { url, body: JSON.parse(init.body), key: init.headers["x-api-key"] };
      return Response.json({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 2 } });
    },
  });
  assert.equal(accepted.status, 202);
  assert.equal(forwarded.url, "https://gateway.example/anthropic/v1/messages");
  assert.equal(forwarded.body.model, "claude-sonnet-4-5");
  assert.equal(forwarded.body.max_tokens, 8192);
  assert.equal(forwarded.key, "gateway-key");
  const status = await handleAgentModelStatus(new Request(`https://x/api/agent-model/${ID}`, { headers: auth }), ID, { store, env });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).response.content[0].text, "ok");
});

test("background relay retries temporary provider limits before succeeding", async () => {
  const store = memoryStore();
  let calls = 0;
  const waits = [];
  const req = new Request("https://x/api/agent-model", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ id: ID, request: { system: "S", messages: [{ role: "user", content: "ciao" }], tools: [] } }),
  });
  const accepted = await handleAgentModelBackground(req, {
    store,
    env,
    now: () => 42,
    sleep: async (ms) => { waits.push(ms); },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return Response.json({ error: "rate limit" }, { status: 429, headers: { "retry-after": "3" } });
      return Response.json({ content: [{ type: "text", text: "ripreso" }], stop_reason: "end_turn", usage: {} });
    },
  });
  assert.equal(accepted.status, 202);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [3000]);
  const status = await handleAgentModelStatus(new Request(`https://x/api/agent-model/${ID}`, { headers: auth }), ID, { store, env });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).response.content[0].text, "ripreso");
});

test("VPS relay client queues then polls without exposing a provider key", async () => {
  let polls = 0;
  let queuedBody;
  const fetchImpl = async (url, init) => {
    if (init.method === "POST") {
      queuedBody = JSON.parse(init.body);
      assert.equal(init.headers.authorization, `Bearer ${TOKEN}`);
      return Response.json({ accepted: true }, { status: 202 });
    }
    polls += 1;
    if (polls === 1) return Response.json({ status: "pending" }, { status: 202 });
    return Response.json({ status: "ok", response: { content: [{ type: "text", text: "fatto" }], stop_reason: "end_turn", usage: { output_tokens: 1 } } });
  };
  const model = new NetlifyRelayModel({ baseUrl: "https://fenix.example/api/agent-model", token: TOKEN, fetchImpl, pollMs: 1 });
  const result = await model.complete({ system: "S", messages: [], tools: [] });
  assert.equal(result.content[0].text, "fatto");
  assert.equal(polls, 2);
  assert.equal(queuedBody.request.system[0].cache_control.type, "ephemeral");
  assert.equal(JSON.stringify(queuedBody).includes("gateway-key"), false);
});
