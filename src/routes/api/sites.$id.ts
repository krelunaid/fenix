import { createFileRoute } from "@tanstack/react-router";
import { readPublished, writePublished } from "@/lib/projects/published-store";
import type { PublishInput } from "@/lib/projects/published";

export const Route = createFileRoute("/api/sites/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const snap = await readPublished(params.id);
        if (!snap) {
          return Response.json({ error: "Sito non trovato" }, { status: 404 });
        }
        return Response.json(snap, {
          headers: { "Cache-Control": "no-store" },
        });
      },
      PUT: async ({ params, request }) => {
        let body: PublishInput = {};
        try {
          body = (await request.json()) as PublishInput;
        } catch {
          return Response.json({ error: "JSON non valido." }, { status: 400 });
        }
        const result = await writePublished(params.id, body);
        if ("error" in result) {
          return Response.json({ error: result.error }, { status: result.status });
        }
        return Response.json(result, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
