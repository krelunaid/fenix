// Model factory: pick a provider by configuration (server BYOK) or per request.
//   AGENT_PROVIDER=anthropic|openai|xai (default anthropic)
//   ANTHROPIC_API_KEY / OPENAI_API_KEY / XAI_API_KEY, optional *_MODEL overrides.
// Per-request keys (user BYOK) are passed in memory only and never logged or stored.
import { AnthropicModel } from "./anthropic.mjs";
import { OpenAICompatibleModel, PROVIDERS } from "./openai.mjs";

export const SUPPORTED_PROVIDERS = ["anthropic", ...Object.keys(PROVIDERS)];

export function createModel({ provider = process.env.AGENT_PROVIDER || "anthropic", apiKey, model, fetchImpl } = {}) {
  const p = String(provider).toLowerCase();
  if (p === "anthropic") {
    return new AnthropicModel({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY, model: model || process.env.ANTHROPIC_MODEL || undefined, fetchImpl });
  }
  if (p === "openai") {
    return new OpenAICompatibleModel({ provider: "openai", apiKey: apiKey || process.env.OPENAI_API_KEY, model: model || process.env.OPENAI_MODEL, fetchImpl });
  }
  if (p === "xai") {
    return new OpenAICompatibleModel({ provider: "xai", apiKey: apiKey || process.env.XAI_API_KEY, model: model || process.env.XAI_MODEL, fetchImpl });
  }
  throw Object.assign(new Error(`Provider non supportato: ${provider}. Usa uno tra ${SUPPORTED_PROVIDERS.join(", ")}.`), { status: 400 });
}

/** Validate a per-request BYOK selection from the proxy; returns null when absent. */
export function byokFromHeaders(headers) {
  const provider = String(headers["x-fenix-model-provider"] || "").toLowerCase();
  const key = String(headers["x-fenix-model-key"] || "");
  const model = String(headers["x-fenix-model"] || "").slice(0, 80) || undefined;
  if (!provider && !key) return null;
  if (!SUPPORTED_PROVIDERS.includes(provider)) throw Object.assign(new Error("Provider BYOK non valido."), { status: 400 });
  if (key.length < 16 || key.length > 400 || /\s/.test(key)) throw Object.assign(new Error("Chiave BYOK non valida."), { status: 400 });
  return { provider, apiKey: key, model };
}
