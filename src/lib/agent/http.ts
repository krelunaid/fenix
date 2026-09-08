/**
 * Studio ↔ agent worker bridge. Shared by the Netlify Function (/api/agent/*)
 * and the Nitro route used in dev. It is the trusted proxy the agent worker
 * expects: it holds AGENT_TOKEN (server only), sets `x-fenix-owner` itself from
 * the caller's identity, and charges/refunds credits on the server.
 *
 * Identity = a verified Better Auth session when the server has persistent accounts
 * (DATABASE_URL + BETTER_AUTH_SECRET), otherwise the device capability header used by
 * the rest of Fenix (see identity.server.ts). Never a client-supplied user id.
 *
 *   GET    /api/agent/status          configured? remaining credits
 *   GET    /api/agent/credits         ledger
 *   POST   /api/agent/build           { brief, kind, name?, extras?, files?, instruction? } -> 202 { id, credits }
 *   GET    /api/agent/jobs/:id[?full=1]   job view (+ refund on terminal failure)
 *   DELETE /api/agent/jobs/:id        cancel (+ refund)
 *   POST/GET/DELETE /api/agent/jobs/:id/preview        start / inspect / stop the live preview
 *                                                      (POST returns { url } with a signed 30-min token)
 *   ANY    /api/agent/preview/:token/*                 relayed into the running project (paths rewritten);
 *                                                      no identity header: the token is the credential,
 *                                                      so the sandboxed (opaque-origin) iframe can use it
 *   GET/POST /api/agent/sites, GET/DELETE /api/agent/sites/:slug   published apps of the caller
 *   ANY    /app/:slug/*  (handlePublicAppRequest)      public traffic of a published app, no identity
 */
import { resolveIdentity } from "./identity.server.ts";
import { previewResponseHeaders, previewTokenPrefix, rewritePreviewCss, rewritePreviewHtml } from "./preview-rewrite.ts";
import { mintPreviewToken, verifyPreviewToken } from "./preview-token.ts";
import {
  AGENT_CREATE_COST,
  AGENT_EDIT_COST,
  chargedFor,
  debit,
  moveCharge,
  readLedger,
  refundOnce,
  type Ledger,
} from "./credits-store.ts";

export const AGENT_NOT_CONFIGURED = "Agente non configurato sul server (AGENT_URL / AGENT_TOKEN).";
const MAX_BODY = 6 * 1024 * 1024;
const MAX_FILES = 120;

export type AgentConfig = { url: string; token: string };

let configOverride: AgentConfig | null | undefined;
/** Test hook. */
export function setAgentConfigForTests(cfg: AgentConfig | null | undefined) {
  configOverride = cfg;
}

export function agentConfig(): AgentConfig | null {
  if (configOverride !== undefined) return configOverride;
  const url = (process.env.AGENT_URL || "").trim().replace(/\/$/, "");
  const token = (process.env.AGENT_TOKEN || "").trim();
  if (!/^https?:\/\//.test(url) || token.length < 16) return null;
  return { url, token };
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Stable hash used for credits and job binding (session-derived when available). */
export async function resolveOwner(request: Request): Promise<string | null> {
  const id = await resolveIdentity(request);
  return id ? id.hash : null;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY) throw Object.assign(new Error("Richiesta troppo grande."), { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error("Richiesta troppo grande."), { status: 413 });
  try {
    const body = JSON.parse(text || "{}") as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error("JSON non valido."), { status: 400 });
  }
}

type AgentJobView = { id: string; status: string; result?: { ok?: boolean } | null; error?: string | null };

const BYOK_HEADERS = ["x-fenix-model-provider", "x-fenix-model-key", "x-fenix-model"] as const;

/** Per-request BYOK headers from the Studio, forwarded verbatim and never logged. */
function byokHeaders(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of BYOK_HEADERS) {
    const v = request.headers.get(h);
    if (v && v.length <= 400) out[h] = v;
  }
  return out;
}

async function upstream(cfg: AgentConfig, owner: string, path: string, init: { method?: string; body?: string; extraHeaders?: Record<string, string> } = {}): Promise<Response> {
  return fetch(`${cfg.url}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${cfg.token}`,
      "x-fenix-owner": owner,
      "content-type": "application/json",
      ...(init.extraHeaders || {}),
    },
    body: init.body,
    signal: AbortSignal.timeout(25_000),
  });
}

function ledgerView(l: Ledger) {
  return { remaining: l.remaining, spent: l.spent, refunded: l.refunded };
}

const TERMINAL_FAILURES = new Set(["failed", "cancelled"]);

/**
 * Handle a request whose path (after /api/agent) is `rest`, e.g. "/build", "/jobs/abc".
 */
export async function handleAgentRequest(request: Request, rest: string): Promise<Response> {
  const cfg = agentConfig();
  const path = rest.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && path === "/status") {
    const id = await resolveIdentity(request);
    const ledger = id ? await readLedger(id.hash) : null;
    return json({ configured: Boolean(cfg), identity: id?.kind ?? null, email: id?.email ?? undefined, credits: ledger ? ledgerView(ledger) : null, hint: cfg ? undefined : AGENT_NOT_CONFIGURED });
  }

  const tk = rest.match(/^\/preview\/([A-Za-z0-9_.-]{60,600})(\/.*)?$/);
  if (tk) {
    if (!cfg) return json({ error: AGENT_NOT_CONFIGURED }, 503);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: previewResponseHeaders("text/plain") });
    const claims = verifyPreviewToken(tk[1], cfg.token);
    if (!claims) return json({ error: "Anteprima scaduta o non valida. Riaprila dallo Studio." }, 401);
    return relayPreview(cfg, claims.owner, claims.jobId, tk[2] || "/", request, previewTokenPrefix(tk[1]));
  }

  const owner = await resolveOwner(request);
  if (!owner) return json({ error: "Identità assente." }, 401);

  if (request.method === "GET" && path === "/credits") {
    return json(ledgerView(await readLedger(owner)));
  }

  if (!cfg) return json({ error: AGENT_NOT_CONFIGURED }, 503);

  try {
    if (request.method === "POST" && path === "/build") {
      const body = await readJson(request);
      const brief = String(body.brief || "").trim().slice(0, 4000);
      const instruction = body.instruction ? String(body.instruction).trim().slice(0, 4000) : "";
      const files = Array.isArray(body.files) ? body.files : [];
      if (brief.length < 3 && !instruction) return json({ error: "Scrivi cosa vuoi costruire." }, 400);
      if (files.length > MAX_FILES) return json({ error: "Troppi file." }, 413);
      if (instruction && files.length === 0) return json({ error: "Una modifica richiede i file del progetto." }, 400);
      const isEdit = Boolean(instruction);
      const cost = isEdit ? AGENT_EDIT_COST : AGENT_CREATE_COST;
      // Charge before dispatch under a provisional key; rebind to the job id after.
      const provisional = `pending:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
      const charged = await debit(owner, cost, provisional);
      if (!charged) {
        return json({ error: `Crediti esauriti: servono ${cost} crediti.`, credits: ledgerView(await readLedger(owner)) }, 402);
      }
      let res: Response;
      try {
        res = await upstream(cfg, owner, "/agent/build", {
          method: "POST",
          extraHeaders: byokHeaders(request),
          body: JSON.stringify({
            brief,
            kind: body.kind === "site" ? "site" : "app",
            name: body.name ? String(body.name).slice(0, 80) : undefined,
            extras: body.extras && typeof body.extras === "object" ? body.extras : undefined,
            files,
            instruction: instruction || undefined,
            parentJobId: typeof body.parentJobId === "string" ? body.parentJobId.slice(0, 64) : undefined,
            context: body.context && typeof body.context === "object" ? body.context : undefined,
          }),
        });
      } catch (err) {
        await refundOnce(owner, provisional, cost);
        return json({ error: `Agente non raggiungibile (${err instanceof Error ? err.message : "rete"}).` }, 502);
      }
      const text = await res.text();
      let payload: { id?: string; error?: string; status?: string; position?: number } = {};
      try { payload = JSON.parse(text) as typeof payload; } catch { /* non-JSON upstream */ }
      if (res.status !== 202 || !payload.id) {
        await refundOnce(owner, provisional, cost);
        return json({ error: payload.error || `Agente ha risposto ${res.status}.` }, res.status >= 400 && res.status < 600 ? res.status : 502);
      }
      // Move the charge onto the real job id so polling/cancel can refund it.
      await moveCharge(owner, provisional, payload.id);
      return json({ id: payload.id, status: payload.status, position: payload.position, credits: ledgerView(await readLedger(owner)) }, 202);
    }

    // Use the raw path here: a trailing slash means "relay the project root".
    // Preview control (owner-authenticated). The relay itself is token-addressed above,
    // but the owner-authenticated relay is kept for tools and tests.
    const pv = rest.match(/^\/jobs\/([A-Za-z0-9-]{8,64})\/preview(\/.*)?$/);
    if (pv) {
      const id = pv[1];
      const relayPath = pv[2];
      if (relayPath == null) {
        if (!["GET", "POST", "DELETE"].includes(request.method)) return json({ error: "Metodo non consentito." }, 405);
        const res = await upstream(cfg, owner, `/agent/jobs/${id}/preview`, { method: request.method });
        const text = await res.text();
        if (request.method === "POST" && res.ok) {
          let view: Record<string, unknown> = {};
          try { view = JSON.parse(text) as Record<string, unknown>; } catch { /* keep empty */ }
          const token = mintPreviewToken(id, owner, cfg.token);
          return json({ ...view, url: `${previewTokenPrefix(token)}/`, token });
        }
        return new Response(text, { status: res.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
      }
      return relayPreview(cfg, owner, id, relayPath, request, `/api/agent/jobs/${encodeURIComponent(id)}/preview`);
    }

    const m = path.match(/^\/jobs\/([A-Za-z0-9-]{8,64})$/);
    if (m) {
      const id = m[1];
      if (request.method === "GET") {
        const full = new URL(request.url).searchParams.get("full") === "1";
        const res = await upstream(cfg, owner, `/agent/jobs/${id}${full ? "?full=1" : ""}`);
        const text = await res.text();
        if (res.status === 404) return json({ error: "Job non trovato." }, 404);
        if (!res.ok) return new Response(text, { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
        let view: AgentJobView | null = null;
        try { view = JSON.parse(text) as AgentJobView; } catch { view = null; }
        if (!view) return json({ error: "Risposta agente non valida." }, 502);
        let refunded = false;
        if (TERMINAL_FAILURES.has(view.status) || (view.status === "ok" && view.result && view.result.ok === false)) {
          const amount = await chargedFor(owner, id);
          const r = await refundOnce(owner, id, amount);
          refunded = r.refundedNow;
        }
        return json({ ...view, credits: ledgerView(await readLedger(owner)), refunded });
      }
      if (request.method === "DELETE") {
        const res = await upstream(cfg, owner, `/agent/jobs/${id}`, { method: "DELETE" });
        if (res.status === 404) return json({ error: "Job non trovato." }, 404);
        const amount = await chargedFor(owner, id);
        const r = await refundOnce(owner, id, amount);
        return json({ id, cancelled: res.ok, refunded: r.refundedNow, credits: ledgerView(r.ledger) });
      }
    }
    if (path === "/sites" && (request.method === "GET" || request.method === "POST")) {
      const body = request.method === "POST" ? await readJson(request) : undefined;
      const res = await upstream(cfg, owner, "/agent/sites", { method: request.method, body: body ? JSON.stringify({ jobId: body.jobId, slug: body.slug, name: body.name }) : undefined });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
    }
    const site = path.match(/^\/sites\/([a-z0-9-]{3,40})$/);
    if (site && (request.method === "GET" || request.method === "DELETE")) {
      const res = await upstream(cfg, owner, `/agent/sites/${site[1]}`, { method: request.method });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
    }
    return json({ error: "Rotta sconosciuta." }, 404);
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    if (status === 500) console.error("[fenix-agent-proxy]", err);
    return json({ error: status === 500 ? "Errore interno." : (err as Error).message }, status);
  }
}

async function relayPreview(cfg: AgentConfig, owner: string, jobId: string, relayPath: string, request: Request, prefix: string): Promise<Response> {
  const search = new URL(request.url).search;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  let res: Response;
  try {
    res = await fetch(`${cfg.url}/agent/jobs/${jobId}/preview${relayPath}${search}`, {
      method: request.method,
      headers: {
        authorization: `Bearer ${cfg.token}`,
        "x-fenix-owner": owner,
        "content-type": request.headers.get("content-type") || "application/octet-stream",
        accept: request.headers.get("accept") || "*/*",
      },
      body,
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    return json({ error: `Anteprima non raggiungibile (${err instanceof Error ? err.message : "rete"}).` }, 502);
  }
  const contentType = res.headers.get("content-type") || "";
  let payload = await res.text();
  if (/text\/html/i.test(contentType)) payload = rewritePreviewHtml(payload, prefix);
  else if (/text\/css/i.test(contentType)) payload = rewritePreviewCss(payload, prefix);
  return new Response(payload, { status: res.status, headers: previewResponseHeaders(contentType) });
}

/**
 * Public entry for published apps: /app/:slug/* — anyone, no identity. The proxy
 * speaks to the agent host with its own token; paths are rewritten to the /app/:slug
 * prefix so the app works at that address.
 */
export async function handlePublicAppRequest(request: Request, slug: string, relayPath: string): Promise<Response> {
  const cfg = agentConfig();
  if (!cfg) return json({ error: AGENT_NOT_CONFIGURED }, 503);
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return json({ error: "Indirizzo non valido." }, 404);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: previewResponseHeaders("text/plain") });
  const search = new URL(request.url).search;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  let res: Response;
  try {
    res = await fetch(`${cfg.url}/agent/sites/${slug}${relayPath || "/"}${search}`, {
      method: request.method,
      headers: {
        authorization: `Bearer ${cfg.token}`,
        "x-fenix-owner": PROXY_IDENTITY,
        "content-type": request.headers.get("content-type") || "application/octet-stream",
        accept: request.headers.get("accept") || "*/*",
      },
      body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    return json({ error: `App non raggiungibile (${err instanceof Error ? err.message : "rete"}).` }, 502);
  }
  const contentType = res.headers.get("content-type") || "";
  let payload = await res.text();
  const prefix = `/app/${slug}`;
  if (/text\/html/i.test(contentType)) payload = rewritePreviewHtml(payload, prefix);
  else if (/text\/css/i.test(contentType)) payload = rewritePreviewCss(payload, prefix);
  const headers = previewResponseHeaders(contentType);
  // Published apps are top-level pages, not framed previews.
  headers["content-security-policy"] = "frame-ancestors 'none'";
  return new Response(payload, { status: res.status, headers });
}

/** Stable pseudo-identity the proxy presents to the agent host for public traffic. */
const PROXY_IDENTITY = "f".repeat(32);
