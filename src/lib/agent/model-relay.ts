import { timingSafeEqual } from "node:crypto";

export const AGENT_MODEL_RELAY_STORE = "fenix-agent-model-relay";
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MODEL_TIMEOUT_MS = 14 * 60 * 1000;
const MODEL_MAX_ATTEMPTS = 5;
const MODEL_MAX_RETRY_MS = 90 * 1000;
const ID_RE = /^[a-f0-9]{8}-[a-f0-9-]{27,40}$/i;

export type RelayStore = {
  get: (key: string, opts?: { type: "json" }) => Promise<unknown>;
  setJSON: (key: string, value: unknown) => Promise<void>;
};

type RelayDeps = {
  store: RelayStore;
  env: (name: string) => string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

type RelayRecord = {
  id: string;
  status: "pending" | "ok" | "error";
  createdAt: number;
  finishedAt?: number;
  response?: unknown;
  error?: string;
  providerStatus?: number;
};

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function bearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export function safeTokenEqual(given: string, expected: string) {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(req: Request, env: RelayDeps["env"]) {
  const expected = env("AGENT_TOKEN") || "";
  return expected.length >= 16 && safeTokenEqual(bearer(req), expected);
}

function relayKey(id: string) {
  return `request:${id}`;
}

function validRequest(value: unknown): value is { id: string; request: Record<string, unknown> } {
  if (!value || typeof value !== "object") return false;
  const body = value as { id?: unknown; request?: unknown };
  if (typeof body.id !== "string" || !ID_RE.test(body.id)) return false;
  if (!body.request || typeof body.request !== "object" || Array.isArray(body.request)) return false;
  const request = body.request as Record<string, unknown>;
  const systemOk = typeof request.system === "string" || (Array.isArray(request.system) && request.system.length > 0);
  return systemOk && Array.isArray(request.messages) && Array.isArray(request.tools);
}

/** Long-running Netlify side of the relay. Its wrapper is a Background Function. */
export async function handleAgentModelBackground(req: Request, deps: RelayDeps): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Metodo non consentito." });
  if (!authorized(req, deps.env)) return json(401, { error: "Token non valido." });

  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json(413, { error: "Richiesta troppo grande." });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "JSON non valido." }); }
  if (!validRequest(body)) return json(400, { error: "Richiesta modello non valida." });

  const now = deps.now || Date.now;
  const createdAt = now();
  await deps.store.setJSON(relayKey(body.id), { id: body.id, status: "pending", createdAt } satisfies RelayRecord);

  const apiKey = deps.env("ANTHROPIC_API_KEY") || "";
  const baseUrl = (deps.env("ANTHROPIC_BASE_URL") || "https://api.anthropic.com").replace(/\/$/, "");
  const model = deps.env("ANTHROPIC_MODEL") || "claude-sonnet-4-5";
  if (!apiKey) {
    const record = { id: body.id, status: "error", createdAt, finishedAt: now(), error: "Gateway AI Netlify non configurato." } satisfies RelayRecord;
    await deps.store.setJSON(relayKey(body.id), record);
    return json(503, { accepted: false });
  }

  const modelRequest = {
    ...body.request,
    model,
    max_tokens: Math.min(8192, Math.max(256, Number(body.request.max_tokens) || 8192)),
  };

  const fetchImpl = deps.fetchImpl || fetch;
  const sleep = deps.sleep || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + MODEL_TIMEOUT_MS;
  try {
    for (let attempt = 1; attempt <= MODEL_MAX_ATTEMPTS; attempt += 1) {
      const remaining = deadline - now();
      if (remaining <= 0) throw new Error("Timeout complessivo del modello.");
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(modelRequest),
          signal: AbortSignal.timeout(Math.max(1, remaining)),
        });
      } catch (err) {
        if (attempt < MODEL_MAX_ATTEMPTS) {
          const retryAfter = retryDelayMs(null, attempt);
          if (retryAfter < deadline - now()) {
            await sleep(retryAfter);
            continue;
          }
        }
        throw err;
      }
      const text = await response.text();
      if (response.ok) {
        let providerResponse: unknown;
        try { providerResponse = JSON.parse(text); } catch { throw new Error("Risposta del modello non JSON."); }
        await deps.store.setJSON(relayKey(body.id), {
          id: body.id,
          status: "ok",
          createdAt,
          finishedAt: now(),
          response: providerResponse,
        } satisfies RelayRecord);
        return json(202, { accepted: true });
      }

      const retryable = response.status === 429 || response.status === 529 || response.status >= 500;
      if (retryable && attempt < MODEL_MAX_ATTEMPTS) {
        const retryAfter = retryDelayMs(response.headers.get("retry-after"), attempt);
        if (retryAfter < deadline - now()) {
          await sleep(retryAfter);
          continue;
        }
      }

      const record = {
        id: body.id,
        status: "error",
        createdAt,
        finishedAt: now(),
        providerStatus: response.status,
        error: `Modello ${response.status}: ${text.slice(0, 300)}`,
      } satisfies RelayRecord;
      await deps.store.setJSON(relayKey(body.id), record);
      return json(202, { accepted: true });
    }
    throw new Error("Tentativi modello esauriti.");
  } catch (err) {
    await deps.store.setJSON(relayKey(body.id), {
      id: body.id,
      status: "error",
      createdAt,
      finishedAt: now(),
      error: err instanceof Error ? err.message.slice(0, 300) : "Errore del modello.",
    } satisfies RelayRecord);
    return json(202, { accepted: true });
  }
}

function retryDelayMs(value: string | null, attempt: number) {
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(MODEL_MAX_RETRY_MS, Math.ceil(seconds * 1000));
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.min(MODEL_MAX_RETRY_MS, Math.max(1000, date - Date.now()));
  }
  return Math.min(MODEL_MAX_RETRY_MS, 2000 * (2 ** (attempt - 1)));
}

/** Short polling endpoint used by the VPS after it queued a background call. */
export async function handleAgentModelStatus(req: Request, id: string, deps: RelayDeps): Promise<Response> {
  if (req.method !== "GET") return json(405, { error: "Metodo non consentito." });
  if (!authorized(req, deps.env)) return json(401, { error: "Token non valido." });
  if (!ID_RE.test(id)) return json(400, { error: "Identificatore non valido." });
  const record = await deps.store.get(relayKey(id), { type: "json" }) as RelayRecord | null;
  if (!record || record.status === "pending") return json(202, { id, status: "pending" });
  if (record.status === "error") return json(502, { id, status: "error", error: record.error || "Errore del modello.", providerStatus: record.providerStatus });
  return json(200, { id, status: "ok", response: record.response });
}
