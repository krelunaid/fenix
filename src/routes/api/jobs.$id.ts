import { createFileRoute } from "@tanstack/react-router";
import { isWorkerJobId, proxyToWorker } from "@/lib/ai/worker-proxy.server";

export const Route = createFileRoute("/api/jobs/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!isWorkerJobId(params.id)) return Response.json({ error: "Job non valido." }, { status: 400 });
        return proxyToWorker(`/jobs/${encodeURIComponent(params.id)}`, { method: "GET" });
      },
    },
  },
});
