import { createFileRoute } from "@tanstack/react-router";
import { handleCloudDataRequest } from "@/lib/projects/cloud-data";

export const Route = createFileRoute("/api/app-data/$siteId")({
  server: {
    handlers: {
      POST: ({ request, params }) => handleCloudDataRequest(request, params.siteId),
    },
  },
});
