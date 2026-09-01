import { createFileRoute } from "@tanstack/react-router";
import { handleReleaseItem } from "@/lib/release/http";

export const Route = createFileRoute("/api/release/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => handleReleaseItem(request, params.id),
      POST: async ({ params, request }) => handleReleaseItem(request, params.id),
    },
  },
});
