import { createFileRoute } from "@tanstack/react-router";
import { handlePublicAppRequest } from "@/lib/agent/http";

/** Dev/Node counterpart of netlify/functions/app-public.ts. */
const relay = ({ request, params }: { request: Request; params: { slug: string; _splat?: string } }) =>
  handlePublicAppRequest(request, params.slug, `/${params._splat ?? ""}`);

export const Route = createFileRoute("/app/$slug/$")({
  server: {
    handlers: { GET: relay, POST: relay, PUT: relay, PATCH: relay, DELETE: relay, OPTIONS: relay },
  },
});
