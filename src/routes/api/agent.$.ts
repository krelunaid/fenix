import { createFileRoute } from "@tanstack/react-router";
import { handleAgentRequest } from "@/lib/agent/http";

/** Dev/Node counterpart of netlify/functions/agent-proxy.ts (same handler). */
const relay = ({ request, params }: { request: Request; params: { _splat?: string } }) =>
  handleAgentRequest(request, `/${params._splat ?? ""}`);

export const Route = createFileRoute("/api/agent/$")({
  server: {
    handlers: {
      GET: relay,
      POST: relay,
      PUT: relay,
      PATCH: relay,
      DELETE: relay,
      OPTIONS: relay,
    },
  },
});
