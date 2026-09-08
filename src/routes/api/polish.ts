import { createFileRoute } from "@tanstack/react-router";
import { proxyToWorker } from "@/lib/ai/worker-proxy.server";

export const Route = createFileRoute("/api/polish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const key = request.headers.get("Idempotency-Key") || request.headers.get("idempotency-key");
        return proxyToWorker("/polish", { method: "POST", body, idempotencyKey: key });
      },
    },
  },
});
