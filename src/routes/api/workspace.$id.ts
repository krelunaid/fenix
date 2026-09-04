import { createFileRoute } from "@tanstack/react-router";
import { handleWorkspaceRequest } from "@/lib/projects/workspace";

export const Route = createFileRoute("/api/workspace/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleWorkspaceRequest(request, params.id),
      POST: ({ request, params }) => handleWorkspaceRequest(request, params.id),
      PUT: ({ request, params }) => handleWorkspaceRequest(request, params.id),
    },
  },
});
