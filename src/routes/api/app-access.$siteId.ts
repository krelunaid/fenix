import { createFileRoute } from "@tanstack/react-router";
import { handleAppCollaborationRequest } from "@/lib/projects/app-collaboration";

export const Route = createFileRoute("/api/app-access/$siteId")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleAppCollaborationRequest(request, params.siteId),
      POST: ({ request, params }) => handleAppCollaborationRequest(request, params.siteId),
    },
  },
});
