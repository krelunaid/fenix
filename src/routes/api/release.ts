import { createFileRoute } from "@tanstack/react-router";
import { handleReleaseCollection } from "@/lib/release/http";

export const Route = createFileRoute("/api/release")({
  server: {
    handlers: {
      GET: async ({ request }) => handleReleaseCollection(request),
      POST: async ({ request }) => handleReleaseCollection(request),
    },
  },
});
