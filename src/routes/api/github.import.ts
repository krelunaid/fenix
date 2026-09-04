import { createFileRoute } from "@tanstack/react-router";
import { handleGitHubImport } from "@/lib/github/http";

export const Route = createFileRoute("/api/github/import")({
  server: {
    handlers: {
      POST: async ({ request }) => handleGitHubImport(request),
    },
  },
});
