import { createFileRoute } from "@tanstack/react-router";
import { handleGitHubExport } from "@/lib/github/http";

export const Route = createFileRoute("/api/github/export")({
  server: {
    handlers: {
      POST: async ({ request }) => handleGitHubExport(request),
    },
  },
});
