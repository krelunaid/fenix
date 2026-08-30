import { createFileRoute } from "@tanstack/react-router";

const WORKER =
  process.env.VISUAL_WORKER_URL?.trim().replace(/\/$/, "") ||
  "https://fenix-production-d9f5.up.railway.app";

export const Route = createFileRoute("/api/jobs/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const r = await fetch(`${WORKER}/jobs/${params.id}`);
        const text = await r.text();
        return new Response(text, {
          status: r.status,
          headers: {
            "Content-Type": r.headers.get("content-type") || "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
