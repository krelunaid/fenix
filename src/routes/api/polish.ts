import { createFileRoute } from "@tanstack/react-router";
import { parseBuildOutput } from "@/lib/ai/parse";

export const Route = createFileRoute("/api/polish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const worker = process.env.VISUAL_WORKER_URL?.trim();
        if (!worker) {
          return new Response(null, { status: 204 });
        }
        let body: { prompt?: string; html?: string } = {};
        try {
          body = (await request.json()) as { prompt?: string; html?: string };
        } catch {
          return Response.json({ error: "JSON non valido" }, { status: 400 });
        }
        const prompt = (body.prompt ?? "").trim().slice(0, 2500);
        const html = (body.html ?? "").slice(0, 120000);
        if (prompt.length < 3 || html.length < 80) {
          return Response.json({ error: "Servono brief e HTML." }, { status: 400 });
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 240_000);
        try {
          const res = await fetch(`${worker.replace(/\/$/, "")}/polish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, html }),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            const err = await res.text().catch(() => "");
            return Response.json(
              { error: err.slice(0, 200) || "Worker visivo non ha risposto." },
              { status: 502 },
            );
          }
          const payload = (await res.json()) as {
            html?: string;
            meta?: Record<string, unknown>;
            log?: string[];
          };
          const parsed = parseBuildOutput(
            `<<<META>>>\n${JSON.stringify(payload.meta ?? {})}\n<<<HTML>>>\n${payload.html ?? ""}\n<<<END>>>`,
          );
          if (!parsed && payload.html) {
            return Response.json({
              result: {
                name: "Studio",
                tagline: "",
                kind: "app",
                summary: "",
                direction: "",
                palette: {
                  bg: "#101114",
                  surface: "#191b20",
                  fg: "#f5f2ea",
                  muted: "#a7a39a",
                  accent: "#e1693f",
                },
                html: payload.html,
                files: [{ path: "index.html", content: payload.html }],
              },
              log: payload.log ?? [],
            });
          }
          if (!parsed) {
            return Response.json({ error: "Patch visiva incompleta." }, { status: 502 });
          }
          return Response.json({ result: parsed, log: payload.log ?? [] });
        } catch {
          return Response.json({ error: "Worker visivo non raggiungibile." }, { status: 504 });
        } finally {
          clearTimeout(timer);
        }
      },
    },
  },
});
