// OpenAI-compatible Chat Completions client (OpenAI, xAI Grok, most proxies) with the
// same `complete({system, messages, tools, signal})` contract as AnthropicModel.
// The agent loop speaks Anthropic content blocks; this adapter translates both ways.
import { estimateCostUsd, mergeUsage } from "./anthropic.mjs";

export const PROVIDERS = {
  openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4.1" },
  xai: { url: "https://api.x.ai/v1/chat/completions", model: "grok-build-0.1" },
};

export class OpenAICompatibleModel {
  constructor({ provider = "openai", apiKey, model, url, maxTokens = 8192, temperature = 0.2, fetchImpl = fetch, maxRetries = 4 } = {}) {
    const preset = PROVIDERS[provider] || PROVIDERS.openai;
    if (!apiKey) throw new Error(`Manca la chiave API per ${provider}.`);
    this.provider = provider;
    this.apiKey = apiKey;
    this.model = model || preset.model;
    this.url = url || preset.url;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.fetch = fetchImpl;
    this.maxRetries = maxRetries;
  }

  async complete({ system, messages, tools, signal }) {
    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [{ role: "system", content: system }, ...toOpenAIMessages(messages)],
      tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
      tool_choice: "auto",
    };
    let attempt = 0;
    for (;;) {
      attempt += 1;
      let res;
      try {
        res = await this.fetch(this.url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify(body),
          signal,
        });
      } catch (err) {
        if (signal?.aborted || attempt > this.maxRetries) throw err;
        await backoff(attempt);
        continue;
      }
      if (res.ok) return fromOpenAIResponse(await res.json());
      const text = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt <= this.maxRetries && !signal?.aborted) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await backoff(attempt, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined);
        continue;
      }
      throw Object.assign(new Error(`${this.provider} ${res.status}: ${text.slice(0, 300)}`), { status: res.status });
    }
  }
}

/** Anthropic-style messages (text / tool_use / tool_result blocks) → OpenAI chat messages. */
export function toOpenAIMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const calls = m.content.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      const msg = { role: "assistant", content: text || null };
      if (calls.length) msg.tool_calls = calls;
      out.push(msg);
      continue;
    }
    // user turn: tool results become `tool` messages; plain text stays a user message
    const results = m.content.filter((b) => b.type === "tool_result");
    for (const r of results) out.push({ role: "tool", tool_call_id: r.tool_use_id, content: typeof r.content === "string" ? r.content : JSON.stringify(r.content) });
    const texts = m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    if (texts) out.push({ role: "user", content: texts });
  }
  return out;
}

/** OpenAI response → { content: blocks, stop_reason, usage } in Anthropic shape. */
export function fromOpenAIResponse(json) {
  const choice = json.choices?.[0] || {};
  const msg = choice.message || {};
  const content = [];
  if (typeof msg.content === "string" && msg.content.trim()) content.push({ type: "text", text: msg.content });
  for (const call of msg.tool_calls || []) {
    let input = {};
    try { input = JSON.parse(call.function?.arguments || "{}"); } catch { input = { _raw: call.function?.arguments }; }
    content.push({ type: "tool_use", id: call.id || `call_${Math.random().toString(36).slice(2)}`, name: call.function?.name, input });
  }
  const u = json.usage || {};
  const cached = u.prompt_tokens_details?.cached_tokens || 0;
  const usage = {
    input_tokens: Math.max(0, (u.prompt_tokens || 0) - cached),
    output_tokens: u.completion_tokens || 0,
    cache_read_input_tokens: cached,
  };
  const stop = choice.finish_reason === "tool_calls" || content.some((b) => b.type === "tool_use") ? "tool_use" : choice.finish_reason === "length" ? "max_tokens" : "end_turn";
  return { content, stop_reason: stop, usage };
}

function backoff(attempt, override) {
  const ms = override ?? Math.min(20_000, 500 * 2 ** attempt + Math.random() * 300);
  return new Promise((r) => setTimeout(r, ms));
}

export { estimateCostUsd, mergeUsage };
