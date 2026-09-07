import { createFileRoute } from "@tanstack/react-router";
import { proxyToWorker } from "@/lib/ai/worker-proxy.server";

/** Replaces the former /__worker/build Netlify redirect: same body, token added server-side. */
export const Route = createFileRoute("/api/worker/build")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const key = request.headers.get("Idempotency-Key") || request.headers.get("idempotency-key");
        return proxyToWorker("/build", { method: "POST", body, idempotencyKey: key, timeoutMs: 30_000 });
      },
    },
  },
});
