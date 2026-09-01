import { createFileRoute } from "@tanstack/react-router";
import { handleGitHubCollection } from "@/lib/github/http";

export const Route = createFileRoute("/api/github")({
  server: {
    handlers: {
      GET: async ({ request }) => handleGitHubCollection(request),
      POST: async ({ request }) => handleGitHubCollection(request),
      DELETE: async ({ request }) => handleGitHubCollection(request),
    },
  },
});
