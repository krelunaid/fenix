import { createFileRoute } from "@tanstack/react-router";
import { handleGitHubRepos } from "@/lib/github/http";

export const Route = createFileRoute("/api/github/repos")({
  server: {
    handlers: {
      GET: async ({ request }) => handleGitHubRepos(request),
    },
  },
});
