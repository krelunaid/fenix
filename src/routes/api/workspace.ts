import { createFileRoute } from "@tanstack/react-router";
import { handleWorkspaceCollection } from "@/lib/projects/workspace";

export const Route = createFileRoute("/api/workspace")({
  server: {
    handlers: {
      GET: ({ request }) => handleWorkspaceCollection(request),
      POST: ({ request }) => handleWorkspaceCollection(request),
    },
  },
});
