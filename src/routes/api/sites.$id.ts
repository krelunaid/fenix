import { createFileRoute } from "@tanstack/react-router";
import { handleSiteRequest } from "@/lib/projects/sites-http";

export const Route = createFileRoute("/api/sites/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => handleSiteRequest(request, params.id),
      PUT: async ({ params, request }) => handleSiteRequest(request, params.id),
    },
  },
});
