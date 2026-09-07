import { createFileRoute } from "@tanstack/react-router";
import { handleAgentRequest } from "@/lib/agent/http";

/** Dev/Node counterpart of netlify/functions/agent-proxy.ts (same handler). */
export const Route = createFileRoute("/api/agent/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleAgentRequest(request, `/${params._splat ?? ""}`),
      POST: ({ request, params }) => handleAgentRequest(request, `/${params._splat ?? ""}`),
      DELETE: ({ request, params }) => handleAgentRequest(request, `/${params._splat ?? ""}`),
    },
  },
});
