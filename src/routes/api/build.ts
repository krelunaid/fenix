import { createFileRoute } from "@tanstack/react-router";
import { parseBuildOutput } from "@/lib/ai/parse";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { detectStage, sseLine } from "@/lib/ai/stages";

type Body = {
  prompt?: string;
  html?: string;
  instruction?: string;
};

export const Route = createFileRoute("/api/build")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Server-only. Never VITE_XAI_API_KEY — that would leak to the browser.
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
          return Response.json(
            { t: "err", error: "Grok non è disponibile in questo ambiente." },
            { status: 503 },
          );
        }

        let body: Body = {};
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ t: "err", error: "Brief non valido." }, { status: 400 });
        }

        const prompt = (body.prompt ?? "").trim().slice(0, 2500);
        if (prompt.length < 3) {
          return Response.json({ t: "err", error: "Scrivi cosa vuoi costruire." }, { status: 400 });
        }

        const instruction = (body.instruction ?? "").trim().slice(0, 2500);
        const html = (body.html ?? "").slice(0, 50000);

        const userParts = [`BRIEF:\n${prompt}`];
        if (html && instruction) userParts.push(`APP ATTUALE (HTML):\n${html}`);
        if (instruction) userParts.push(`MODIFICA:\n${instruction}\nApplica questa modifica e restituisci l'app completa, funzionante.`);
        userParts.push("Costruisci ora. Formato META + HTML, nient'altro.");

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: Parameters<typeof sseLine>[0]) => {
              controller.enqueue(encoder.encode(sseLine(event)));
            };
            const abort = new AbortController();
            const timer = setTimeout(() => abort.abort(), 110_000);
            try {
              const res = await fetch("https://api.x.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                signal: abort.signal,
                body: JSON.stringify({
                  model: "grok-4.5",
                  temperature: 0.75,
                  max_tokens: 12000,
                  reasoning_effort: "low",
                  stream: true,
                  messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userParts.join("\n\n") },
                  ],
                }),
              });

              if (!res.ok || !res.body) {
                const text = await res.text().catch(() => "");
                const msg =
                  res.status === 429
                    ? "Troppe richieste. Attendi un momento e riprova."
                    : `Il modello non ha risposto (${res.status}). ${text.slice(0, 160)}`.trim();
                send({ t: "err", error: msg });
                controller.close();
                return;
              }

              send({ t: "s", s: "Leggo il brief e scelgo la direzione" });

              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              let acc = "";
              let lastStage = "Leggo il brief e scelgo la direzione";
              let lastProgress = 0;

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const chunks = buffer.split("\n");
                buffer = chunks.pop() ?? "";
                for (const line of chunks) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const payload = trimmed.slice(5).trim();
                  if (payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload) as {
                      choices?: { delta?: { content?: string } }[];
                    };
                    const delta = json.choices?.[0]?.delta?.content ?? "";
                    if (!delta) continue;
                    acc += delta;
                    const stage = detectStage(acc);
                    if (stage && stage !== lastStage) {
                      lastStage = stage;
                      send({ t: "s", s: stage });
                    }
                    if (acc.length - lastProgress >= 400) {
                      lastProgress = acc.length;
                      send({ t: "p", n: acc.length });
                    }
                  } catch {
                    /* ignore malformed sse lines */
                  }
                }
              }

              const parsed = parseBuildOutput(acc, prompt);
              if (!parsed) {
                send({
                  t: "err",
                  error: "Risposta incompleta. Riprova, magari con un brief più stretto.",
                });
              } else {
                send({ t: "ok", result: parsed });
              }
            } catch (err) {
              const aborted = err instanceof Error && err.name === "AbortError";
              send({
                t: "err",
                error: aborted
                  ? "Ci ho messo troppo. Accorcia il brief e riprova."
                  : err instanceof Error
                    ? `Non riesco a raggiungere il modello (${err.message}).`
                    : "Errore di rete. Riprova.",
              });
            } finally {
              clearTimeout(timer);
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
