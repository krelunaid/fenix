// Anthropic Messages API client — no SDK, plain fetch. Supports tool use, prompt
// caching on the system prompt and retries on 429/5xx/overloaded.
//
// Env: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (default below — verify the
// current id on https://docs.claude.com/en/docs/about-claude/models).
export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const VERSION = "2023-06-01";

export function anthropicEndpoint({ url, baseUrl } = {}) {
  if (url) return String(url).replace(/\/$/, "");
  if (baseUrl) return `${String(baseUrl).replace(/\/$/, "")}/v1/messages`;
  return ANTHROPIC_URL;
}

// USD per million tokens; used only for the cost estimate shown to the user.
const PRICES = {
  default: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};

export function estimateCostUsd(usage, model = DEFAULT_MODEL) {
  const p = PRICES[model] || PRICES.default;
  const m = (n) => (n || 0) / 1_000_000;
  return m(usage.input_tokens) * p.input
    + m(usage.output_tokens) * p.output
    + m(usage.cache_read_input_tokens) * p.cacheRead
    + m(usage.cache_creation_input_tokens) * p.cacheWrite;
}

export function mergeUsage(total, usage) {
  for (const k of ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]) {
    total[k] = (total[k] || 0) + (usage?.[k] || 0);
  }
  return total;
}

export class AnthropicModel {
  constructor({
    apiKey = process.env.ANTHROPIC_API_KEY,
    model = DEFAULT_MODEL,
    url = process.env.ANTHROPIC_URL,
    baseUrl = process.env.ANTHROPIC_BASE_URL,
    maxTokens = 8192,
    temperature = 0.2,
    fetchImpl = fetch,
    maxRetries = 4,
  } = {}) {
    if (!apiKey) throw new Error("Manca ANTHROPIC_API_KEY sul server.");
    this.apiKey = apiKey;
    this.model = model;
    this.url = anthropicEndpoint({ url, baseUrl });
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.fetch = fetchImpl;
    this.maxRetries = maxRetries;
  }

  /**
   * @param {{ system: string, messages: object[], tools: object[], signal?: AbortSignal }} req
   * @returns {Promise<{ content: object[], stop_reason: string, usage: object }>}
   */
  async complete({ system, messages, tools, signal }) {
    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    };
    let attempt = 0;
    for (;;) {
      attempt += 1;
      let res;
      try {
        res = await this.fetch(this.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": VERSION,
          },
          body: JSON.stringify(body),
          signal,
        });
      } catch (err) {
        if (signal?.aborted || attempt > this.maxRetries) throw err;
        await backoff(attempt);
        continue;
      }
      if (res.ok) {
        const json = await res.json();
        return { content: json.content || [], stop_reason: json.stop_reason || "end_turn", usage: json.usage || {} };
      }
      const text = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
      if (retryable && attempt <= this.maxRetries && !signal?.aborted) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await backoff(attempt, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined);
        continue;
      }
      throw Object.assign(new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`), { status: res.status });
    }
  }
}

function backoff(attempt, override) {
  const ms = override ?? Math.min(20_000, 500 * 2 ** attempt + Math.random() * 300);
  return new Promise((r) => setTimeout(r, ms));
}
