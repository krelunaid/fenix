// Durable model transport for the Fenix VPS. The request runs inside a Netlify
// Background Function, where Netlify AI Gateway credentials are valid, and this
// client polls the authenticated result endpoint.
import { randomUUID } from "node:crypto";

export class NetlifyRelayModel {
  constructor({
    baseUrl = process.env.FENIX_MODEL_RELAY_URL,
    token = process.env.AGENT_TOKEN,
    model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    maxTokens = 8192,
    temperature = 0.2,
    fetchImpl = fetch,
    pollMs = 1000,
    maxRetries = 4,
  } = {}) {
    if (!baseUrl) throw new Error("Manca FENIX_MODEL_RELAY_URL sul server.");
    if (!token || token.length < 16) throw new Error("Manca AGENT_TOKEN per il relay del modello.");
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") throw new Error("Il relay del modello deve usare HTTPS.");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.fetch = fetchImpl;
    this.pollMs = pollMs;
    this.maxRetries = maxRetries;
  }

  async complete({ system, messages, tools, signal }) {
    const headers = { authorization: `Bearer ${this.token}`, "content-type": "application/json" };
    const request = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    };

    for (let attempt = 1; ; attempt += 1) {
      const id = randomUUID();
      let queued;
      try {
        queued = await this.fetch(this.baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ id, request }),
          signal,
        });
      } catch (err) {
        if (attempt > this.maxRetries || signal?.aborted) throw err;
        await wait(relayBackoff(attempt), signal);
        continue;
      }
      if (queued.status !== 202 && !queued.ok) {
        const text = await queued.text().catch(() => "");
        const err = modelError("Relay Netlify", queued, text);
        if (attempt > this.maxRetries || !retryableRelayError(queued.status, text) || signal?.aborted) throw err;
        await wait(relayBackoff(attempt), signal);
        continue;
      }

      for (;;) {
        await wait(this.pollMs, signal);
        const res = await this.fetch(`${this.baseUrl}/${id}`, { method: "GET", headers: { authorization: `Bearer ${this.token}` }, signal });
        if (res.status === 202) continue;
        const text = await res.text().catch(() => "");
        if (!res.ok) {
          const err = modelError("Relay Netlify", res, text);
          if (attempt > this.maxRetries || !retryableRelayError(res.status, text) || signal?.aborted) throw err;
          await wait(relayBackoff(attempt), signal);
          break;
        }
        let payload;
        try { payload = JSON.parse(text); } catch { throw new Error("Relay Netlify: risposta non JSON."); }
        const reply = payload?.response;
        if (!reply || !Array.isArray(reply.content)) throw new Error("Relay Netlify: risposta del modello incompleta.");
        return { content: reply.content, stop_reason: reply.stop_reason || "end_turn", usage: reply.usage || {} };
      }
    }
  }
}

function retryableRelayError(status, text) {
  if (status >= 500 && status !== 501) return true;
  try {
    const payload = JSON.parse(text);
    const providerStatus = Number(payload?.providerStatus || 0);
    if (providerStatus === 429 || providerStatus === 529 || providerStatus >= 500) return true;
    return /fetch failed|timeout|timed out|overload|temporar|econn|network/i.test(String(payload?.error || ""));
  } catch {
    return /fetch failed|timeout|timed out|overload|temporar|econn|network/i.test(text);
  }
}

function relayBackoff(attempt) {
  return Math.min(20_000, 2000 * (2 ** (attempt - 1)));
}

function modelError(prefix, response, text) {
  let message = text;
  try { message = JSON.parse(text)?.error || text; } catch { /* keep plain text */ }
  return Object.assign(new Error(`${prefix} ${response.status}: ${String(message).slice(0, 300)}`), { status: response.status });
}

function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    function done() { signal?.removeEventListener("abort", abort); resolve(); }
    signal?.addEventListener("abort", abort, { once: true });
  });
}
