import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/polish")({
  server: {
    handlers: {
      POST: async () => {
        const worker = process.env.VISUAL_WORKER_URL?.trim();
        if (!worker) {
          return new Response(null, { status: 204 });
        }
        return new Response(null, {
          status: 307,
          headers: {
            Location: `${worker.replace(/\/$/, "")}/polish`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
