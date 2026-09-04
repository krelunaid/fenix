import { createFileRoute } from "@tanstack/react-router";
import { handleGitHubCallback } from "@/lib/github/http";

export const Route = createFileRoute("/api/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => handleGitHubCallback(request),
    },
  },
});
