/**
 * Server-only bridge to the visual worker (Railway). The browser never talks to
 * the worker directly any more: every call goes through /api/worker/*, /api/polish
 * and /api/jobs/:id, which add the shared secret from the server environment.
 *
 * Env (server): VISUAL_WORKER_URL, VISUAL_WORKER_TOKEN. Never VITE_*.
 */
const DEFAULT_WORKER_URL = "https://fenix-production-d9f5.up.railway.app";

export function workerBaseUrl(): string {
  return (process.env.VISUAL_WORKER_URL?.trim() || DEFAULT_WORKER_URL).replace(/\/$/, "");
}

export function workerToken(): string {
  return process.env.VISUAL_WORKER_TOKEN?.trim() || "";
}

export type WorkerProxyInit = {
  method?: "GET" | "POST";
  body?: string;
  idempotencyKey?: string | null;
  timeoutMs?: number;
};

/** Forward a request to the worker and return a Response to hand back to the client. */
export async function proxyToWorker(path: string, init: WorkerProxyInit = {}): Promise<Response> {
  const token = workerToken();
  if (!token && process.env.NETLIFY) {
    return Response.json(
      { error: "Worker non configurato sul server (VISUAL_WORKER_TOKEN)." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  let upstream: Response;
  try {
    upstream = await fetch(`${workerBaseUrl()}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      signal: AbortSignal.timeout(init.timeoutMs ?? 25_000),
    });
  } catch (err) {
    return Response.json(
      { error: `Worker non raggiungibile (${err instanceof Error ? err.message : "rete"}).` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/** Only the job id shape the worker mints (uuid) or the legacy base36 ids. */
export function isWorkerJobId(id: string): boolean {
  return /^[A-Za-z0-9-]{8,64}$/.test(id);
}
