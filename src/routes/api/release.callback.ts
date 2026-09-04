import { createFileRoute } from "@tanstack/react-router";
import { handleReleaseCallback } from "@/lib/release/http";

export const Route = createFileRoute("/api/release/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => handleReleaseCallback(request),
    },
  },
});
