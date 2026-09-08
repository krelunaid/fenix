import { isWorkerJobId, proxyToWorker } from "../../src/lib/ai/worker-proxy.server.ts";

/**
 * Replaces the old `/__worker/*` redirect to Railway. Same client paths, but the
 * worker token is added here (server side) and only the three worker routes are
 * reachable: POST /build, POST /polish, GET /jobs/:id.
 */
export default async (req: Request) => {
  const url = new URL(req.url);
  const rest = url.pathname.replace(/^\/__worker/, "") || "/";
  const key = req.headers.get("idempotency-key");
  if (req.method === "POST" && (rest === "/build" || rest === "/polish")) {
    return proxyToWorker(rest, { method: "POST", body: await req.text(), idempotencyKey: key, timeoutMs: 25_000 });
  }
  const job = rest.match(/^\/jobs\/([^/]+)$/);
  if (req.method === "GET" && job && isWorkerJobId(job[1])) {
    return proxyToWorker(`/jobs/${encodeURIComponent(job[1])}`, { method: "GET" });
  }
  return Response.json({ error: "Rotta worker non consentita." }, { status: 404, headers: { "Cache-Control": "no-store" } });
};

export const config = {
  path: "/__worker/*",
};
