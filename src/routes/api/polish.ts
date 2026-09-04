import { createFileRoute } from "@tanstack/react-router";

const WORKER =
  process.env.VISUAL_WORKER_URL?.trim().replace(/\/$/, "") ||
  "https://fenix-production-d9f5.up.railway.app";

export const Route = createFileRoute("/api/polish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const key =
          request.headers.get("Idempotency-Key") || request.headers.get("idempotency-key");
        if (key) headers["Idempotency-Key"] = key;
        const r = await fetch(`${WORKER}/polish`, {
          method: "POST",
          headers,
          body,
        });
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
